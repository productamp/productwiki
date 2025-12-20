import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { generateWiki, generateBriefWiki, generateDetailedWiki, generateProductDocs } from '../services/wikiGenerator.js';
import { logError } from '../services/errorLog.js';

export const wikiRoutes = new Hono();

/**
 * Generate brief wiki documentation (SSE streaming)
 * Uses predefined brief template structure
 */
wikiRoutes.post('/wiki/brief', async (c) => {
  const { owner, repo } = await c.req.json();

  if (!owner || !repo) {
    return c.json({ error: 'Owner and repo are required' }, 400);
  }

  return streamSSE(c, async (stream) => {
    try {
      const options = {
        apiKey: c.get('apiKey'),
        provider: c.get('llmProvider'),
        model: c.get('geminiModel'),
      };

      for await (const event of generateBriefWiki(owner, repo, options)) {
        await stream.writeSSE({ data: JSON.stringify(event) });
      }

      await stream.writeSSE({ data: '[DONE]' });
    } catch (err) {
      logError(`Brief wiki generation error: ${err.message}`);
      console.error(err);
      await stream.writeSSE({ data: JSON.stringify({ type: 'error', message: err.message }) });
    }
  });
});

/**
 * Generate detailed wiki documentation (SSE streaming)
 * Uses predefined detailed template structure
 */
wikiRoutes.post('/wiki/detailed', async (c) => {
  const { owner, repo } = await c.req.json();

  if (!owner || !repo) {
    return c.json({ error: 'Owner and repo are required' }, 400);
  }

  return streamSSE(c, async (stream) => {
    try {
      const options = {
        apiKey: c.get('apiKey'),
        provider: c.get('llmProvider'),
        model: c.get('geminiModel'),
      };

      for await (const event of generateDetailedWiki(owner, repo, options)) {
        await stream.writeSSE({ data: JSON.stringify(event) });
      }

      await stream.writeSSE({ data: '[DONE]' });
    } catch (err) {
      logError(`Detailed wiki generation error: ${err.message}`);
      console.error(err);
      await stream.writeSSE({ data: JSON.stringify({ type: 'error', message: err.message }) });
    }
  });
});

/**
 * Generate wiki with dynamic structure (SSE streaming)
 * LLM analyzes codebase and determines optimal structure
 */
wikiRoutes.post('/wiki/dynamic', async (c) => {
  const { owner, repo } = await c.req.json();

  if (!owner || !repo) {
    return c.json({ error: 'Owner and repo are required' }, 400);
  }

  return streamSSE(c, async (stream) => {
    try {
      const options = {
        apiKey: c.get('apiKey'),
        provider: c.get('llmProvider'),
        model: c.get('geminiModel'),
      };

      for await (const event of generateWiki(owner, repo, 'dynamic', options)) {
        await stream.writeSSE({ data: JSON.stringify(event) });
      }

      await stream.writeSSE({ data: '[DONE]' });
    } catch (err) {
      logError(`Dynamic wiki generation error: ${err.message}`);
      console.error(err);
      await stream.writeSSE({ data: JSON.stringify({ type: 'error', message: err.message }) });
    }
  });
});

/**
 * Generate product documentation (SSE streaming)
 * End-user focused documentation emphasizing functionality and features
 */
wikiRoutes.post('/wiki/product-docs', async (c) => {
  const { owner, repo } = await c.req.json();

  if (!owner || !repo) {
    return c.json({ error: 'Owner and repo are required' }, 400);
  }

  return streamSSE(c, async (stream) => {
    try {
      const options = {
        apiKey: c.get('apiKey'),
        provider: c.get('llmProvider'),
        model: c.get('geminiModel'),
      };

      for await (const event of generateProductDocs(owner, repo, options)) {
        await stream.writeSSE({ data: JSON.stringify(event) });
      }

      await stream.writeSSE({ data: '[DONE]' });
    } catch (err) {
      logError(`Product documentation generation error: ${err.message}`);
      console.error(err);
      await stream.writeSSE({ data: JSON.stringify({ type: 'error', message: err.message }) });
    }
  });
});
