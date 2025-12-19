import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { indexRepositoryWithProgress } from '../services/indexer.js';
import { isIndexed } from '../services/vectorStore.js';
import { logError } from '../services/errorLog.js';

export const indexRoutes = new Hono();

// Trigger indexing with SSE progress stream
indexRoutes.post('/index', async (c) => {
  const { url } = await c.req.json();

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
        apiKey: c.get('apiKey'),
        provider: c.get('llmProvider'),
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
      logError(`Index error: ${err.message}`);
      console.error(err);

      if (err.message === 'Indexing cancelled') {
        await stream.writeSSE({ data: JSON.stringify({ phase: 'cancelled' }) });
      } else {
        await stream.writeSSE({ data: JSON.stringify({ phase: 'error', error: err.message }) });
      }
    }
  });
});

// Check index status
indexRoutes.get('/index/status/:owner/:repo', async (c) => {
  const { owner, repo } = c.req.param();

  try {
    const indexed = await isIndexed(owner, repo);
    return c.json({ indexed });
  } catch (err) {
    console.error(err);
    return c.json({ error: err.message }, 500);
  }
});
