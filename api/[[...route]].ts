/**
 * Main Vercel API entry point using Hono
 * Handles all API routes with SSE streaming support
 */
import { Hono } from 'hono';
import { handle } from '@hono/node-server/vercel';
import { cors } from 'hono/cors';
import { streamSSE } from 'hono/streaming';

// Import services
import { indexRepositoryWithProgress, IndexProgress, chunkDocument } from './_lib/indexer.js';
import { isIndexed, listProjects, getProjectMetadata, storeEmbeddings, saveProjectMetadata } from './_lib/vectorStore.js';
import { processRepository } from './_lib/github.js';
import { embedBatch } from './_lib/embeddings.js';
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

// Prepare index (fetch + chunk) - for client-side batching
app.post('/index-prepare', async (c) => {
  const { url } = await c.req.json<{ url: string }>();

  if (!url) {
    return c.json({ error: 'URL is required' }, 400);
  }

  try {
    // Fetch and chunk repository
    const { owner, repo, files, branch } = await processRepository(url);
    const allChunks = [];

    for (const file of files) {
      const chunks = chunkDocument(file);
      allChunks.push(...chunks);
    }

    return c.json({
      owner,
      repo,
      branch,
      url,
      fileCount: files.length,
      chunks: allChunks.map(chunk => ({
        id: chunk.id,
        path: chunk.path,
        content: chunk.content,
        chunkIndex: chunk.chunkIndex,
        totalChunks: chunk.totalChunks,
        extension: chunk.extension,
      })),
    });
  } catch (err) {
    console.error('Prepare index error:', err);
    return c.json({ error: (err as Error).message }, 500);
  }
});

// Embed batch (small batch for client-side batching)
app.post('/embed-batch', async (c) => {
  const { owner, repo, chunks } = await c.req.json<{
    owner: string;
    repo: string;
    chunks: Array<{
      id: string;
      path: string;
      content: string;
      chunkIndex: number;
      totalChunks: number;
      extension: string;
    }>;
  }>();

  if (!owner || !repo || !chunks || chunks.length === 0) {
    return c.json({ error: 'owner, repo, and chunks are required' }, 400);
  }

  if (chunks.length > 50) {
    return c.json({ error: 'Max 50 chunks per batch' }, 400);
  }

  try {
    // Embed chunks
    const texts = chunks.map(c => c.content);
    const embeddings = await embedBatch(texts, c.get('apiKeys') as (string | KeyEntry)[]);

    // Attach vectors and store
    const chunksWithVectors = chunks.map((chunk, i) => ({
      ...chunk,
      vector: embeddings[i],
    }));

    await storeEmbeddings(owner, repo, chunksWithVectors);

    return c.json({ success: true, processed: chunks.length });
  } catch (err) {
    console.error('Embed batch error:', err);
    return c.json({ error: (err as Error).message }, 500);
  }
});

// Complete index (save metadata) - for client-side batching
app.post('/index-complete', async (c) => {
  const { owner, repo, url, branch, fileCount, chunkCount } = await c.req.json<{
    owner: string;
    repo: string;
    url: string;
    branch: string;
    fileCount: number;
    chunkCount: number;
  }>();

  if (!owner || !repo) {
    return c.json({ error: 'owner and repo are required' }, 400);
  }

  try {
    const metadata = {
      owner,
      repo,
      url,
      branch,
      indexedAt: new Date().toISOString(),
      fileCount,
      chunkCount,
      embedding: {
        provider: 'gemini',
        model: config.embeddingModel,
        dimensions: config.embeddingDimensions,
      },
    };

    await saveProjectMetadata(owner, repo, metadata);

    return c.json({ success: true, metadata });
  } catch (err) {
    console.error('Complete index error:', err);
    return c.json({ error: (err as Error).message }, 500);
  }
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
