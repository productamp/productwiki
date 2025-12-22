/**
 * Main Vercel API entry point using Hono
 * Handles all API routes with SSE streaming support
 */
import { Hono } from 'hono';
import { handle } from '@hono/node-server/vercel';
import { cors } from 'hono/cors';
import { streamSSE } from 'hono/streaming';

// Import services
import { indexRepositoryWithProgress, IndexProgress } from './_lib/indexer.js';
import { isIndexed, listProjects, getProjectMetadata } from './_lib/vectorStore.js';
import { generateDocumentation, generatePackagePrompt, generateReimplementPrompt } from './_lib/rag.js';
import {
  generateBriefWiki,
  generateDetailedWiki,
  generateWiki,
  generateProductDocs,
  WikiEvent,
} from './_lib/wikiGenerator.js';
import { config } from './_lib/config.js';
import { KeyEntry } from './_lib/api-key-pool.js';

// Create Hono app
const app = new Hono().basePath('/api');

// Middleware
app.use('*', cors());

// Extract API keys, provider, and model from headers into context
app.use('*', async (c, next) => {
  const apiKeysHeader = c.req.header('x-api-keys');
  let apiKeys: (string | KeyEntry)[] = [];

  if (apiKeysHeader) {
    try {
      apiKeys = JSON.parse(apiKeysHeader);
    } catch {
      apiKeys = [];
    }
  }

  // Fallback to single key for backwards compat
  if (apiKeys.length === 0) {
    const singleKey = c.req.header('x-api-key');
    if (singleKey) {
      apiKeys = [singleKey];
    }
  }

  // Use env var as default fallback (key feature for this demo)
  if (apiKeys.length === 0 && process.env.GOOGLE_API_KEY) {
    apiKeys = [{ key: process.env.GOOGLE_API_KEY, label: 'Default' }];
  }

  c.set('apiKeys', apiKeys);
  c.set('apiKey', typeof apiKeys[0] === 'string' ? apiKeys[0] : apiKeys[0]?.key || null);
  c.set('llmProvider', c.req.header('x-llm-provider'));
  c.set('geminiModel', c.req.header('x-gemini-model'));
  await next();
});

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============ Index Routes ============

// Trigger indexing with SSE progress stream
app.post('/index', async (c) => {
  const { url } = await c.req.json<{ url: string }>();

  if (!url) {
    return c.json({ error: 'URL is required' }, 400);
  }

  return streamSSE(c, async (stream) => {
    const abortSignal = { aborted: false };

    c.req.raw.signal.addEventListener('abort', () => {
      abortSignal.aborted = true;
    });

    try {
      const options = {
        apiKeys: c.get('apiKeys') as (string | KeyEntry)[],
        signal: abortSignal,
      };

      const generator = indexRepositoryWithProgress(url, options);

      while (true) {
        const { done, value } = await generator.next();
        if (done) break;
        await stream.writeSSE({ data: JSON.stringify(value) });
      }

      await stream.writeSSE({ data: JSON.stringify({ phase: 'done' }) });
    } catch (err) {
      console.error('Index error:', err);

      if ((err as Error).message === 'Indexing cancelled') {
        await stream.writeSSE({ data: JSON.stringify({ phase: 'cancelled' }) });
      } else {
        await stream.writeSSE({ data: JSON.stringify({ phase: 'error', error: (err as Error).message }) });
      }
    }
  });
});

// Check index status
app.get('/index/status/:owner/:repo', async (c) => {
  const { owner, repo } = c.req.param();

  try {
    const indexed = await isIndexed(owner, repo);
    return c.json({ indexed });
  } catch (err) {
    console.error(err);
    return c.json({ error: (err as Error).message }, 500);
  }
});

// ============ Projects Routes ============

// List all indexed projects
app.get('/projects', async (c) => {
  try {
    const projects = await listProjects();
    // Sort by indexedAt descending
    projects.sort((a, b) => new Date(b.indexedAt).getTime() - new Date(a.indexedAt).getTime());
    return c.json(projects);
  } catch (err) {
    console.error(err);
    return c.json({ error: (err as Error).message }, 500);
  }
});

// Get single project metadata with compatibility check
app.get('/projects/:owner/:repo', async (c) => {
  const { owner, repo } = c.req.param();

  try {
    const metadata = await getProjectMetadata(owner, repo);

    if (!metadata) {
      return c.json({ error: 'Project not found' }, 404);
    }

    // Check embedding compatibility
    const currentEmbedding = {
      provider: 'gemini',
      model: config.embeddingModel,
      dimensions: config.embeddingDimensions,
    };

    let compatibility = { compatible: true, reason: '' };
    if (!metadata.embedding) {
      compatibility = {
        compatible: false,
        reason: 'Project was indexed before embedding tracking was added. Re-index recommended.',
      };
    } else if (metadata.embedding.provider !== currentEmbedding.provider) {
      compatibility = {
        compatible: false,
        reason: `Project was indexed with ${metadata.embedding.provider}, but current provider is ${currentEmbedding.provider}.`,
      };
    } else if (metadata.embedding.model !== currentEmbedding.model) {
      compatibility = {
        compatible: false,
        reason: `Project was indexed with ${metadata.embedding.model}, but current model is ${currentEmbedding.model}.`,
      };
    }

    return c.json({
      ...metadata,
      embeddingCompatibility: compatibility,
    });
  } catch (err) {
    console.error(err);
    return c.json({ error: (err as Error).message }, 500);
  }
});

// ============ Generate Routes ============

// Helper to create simple content generation handlers
function createGenerateHandler(
  type: string,
  generator: (owner: string, repo: string, options: any) => AsyncGenerator<string>
) {
  return async (c: any) => {
    const { owner, repo } = await c.req.json<{ owner: string; repo: string }>();

    if (!owner || !repo) {
      return c.json({ error: 'Owner and repo are required' }, 400);
    }

    const options = {
      apiKeys: c.get('apiKeys') as (string | KeyEntry)[],
      model: c.get('geminiModel') as string | undefined,
    };

    return streamSSE(c, async (stream) => {
      try {
        for await (const chunk of generator(owner, repo, options)) {
          await stream.writeSSE({ data: JSON.stringify({ content: chunk }) });
        }
        await stream.writeSSE({ data: '[DONE]' });
      } catch (err) {
        console.error(`${type} generation error:`, err);
        await stream.writeSSE({ data: JSON.stringify({ error: (err as Error).message }) });
      }
    });
  };
}

// Generate documentation (SSE streaming)
app.post('/generate/docs', createGenerateHandler('docs', generateDocumentation));

// Generate package/migration prompt (SSE streaming)
app.post('/generate/package-prompt', createGenerateHandler('package-prompt', generatePackagePrompt));

// Generate reimplement prompt (SSE streaming)
app.post('/generate/reimplement-prompt', createGenerateHandler('reimplement-prompt', generateReimplementPrompt));

// ============ Wiki Routes ============

// Helper to create wiki generation handlers
function createWikiHandler(
  type: string,
  generator: (owner: string, repo: string, options: any) => AsyncGenerator<WikiEvent>
) {
  return async (c: any) => {
    const { owner, repo } = await c.req.json<{ owner: string; repo: string }>();

    if (!owner || !repo) {
      return c.json({ error: 'Owner and repo are required' }, 400);
    }

    const options = {
      apiKeys: c.get('apiKeys') as (string | KeyEntry)[],
      model: c.get('geminiModel') as string | undefined,
    };

    return streamSSE(c, async (stream) => {
      try {
        for await (const event of generator(owner, repo, options)) {
          await stream.writeSSE({ data: JSON.stringify(event) });
        }
        await stream.writeSSE({ data: '[DONE]' });
      } catch (err) {
        console.error(`${type} wiki generation error:`, err);
        await stream.writeSSE({ data: JSON.stringify({ type: 'error', message: (err as Error).message }) });
      }
    });
  };
}

// Generate brief wiki documentation (SSE streaming)
app.post('/wiki/brief', createWikiHandler('brief', generateBriefWiki));

// Generate detailed wiki documentation (SSE streaming)
app.post('/wiki/detailed', createWikiHandler('detailed', generateDetailedWiki));

// Generate wiki with dynamic structure (SSE streaming)
app.post('/wiki/dynamic', createWikiHandler('dynamic', (owner, repo, options) => generateWiki(owner, repo, 'dynamic', options)));

// Generate product documentation (SSE streaming)
app.post('/wiki/product-docs', createWikiHandler('product-docs', generateProductDocs));

// ============ Logs Routes (simplified for serverless) ============

app.get('/logs', (c) => {
  // In serverless, we don't have persistent in-memory logs
  // Return empty array - logs can be viewed in Vercel dashboard
  return c.json([]);
});

app.delete('/logs', (c) => {
  return c.json({ cleared: true });
});

// Export for Vercel
export const GET = handle(app);
export const POST = handle(app);
export const DELETE = handle(app);

// Also export the app for local development
export default app;
