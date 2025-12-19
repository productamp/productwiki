import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { generateDocumentation, generatePackagePrompt, generateReimplementPrompt } from '../services/rag.js';
import { logError } from '../services/errorLog.js';

export const generateRoutes = new Hono();

// Generate documentation (SSE streaming)
generateRoutes.post('/generate/docs', async (c) => {
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

      for await (const chunk of generateDocumentation(owner, repo, options)) {
        await stream.writeSSE({ data: JSON.stringify({ content: chunk }) });
      }

      await stream.writeSSE({ data: '[DONE]' });
    } catch (err) {
      logError(`Generate error: ${err.message}`);
      console.error(err);
      await stream.writeSSE({ data: JSON.stringify({ error: err.message }) });
    }
  });
});

// Generate package/migration prompt (SSE streaming)
generateRoutes.post('/generate/package-prompt', async (c) => {
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

      for await (const chunk of generatePackagePrompt(owner, repo, options)) {
        await stream.writeSSE({ data: JSON.stringify({ content: chunk }) });
      }

      await stream.writeSSE({ data: '[DONE]' });
    } catch (err) {
      logError(`Package prompt error: ${err.message}`);
      console.error(err);
      await stream.writeSSE({ data: JSON.stringify({ error: err.message }) });
    }
  });
});

// Generate reimplement prompt (SSE streaming)
generateRoutes.post('/generate/reimplement-prompt', async (c) => {
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

      for await (const chunk of generateReimplementPrompt(owner, repo, options)) {
        await stream.writeSSE({ data: JSON.stringify({ content: chunk }) });
      }

      await stream.writeSSE({ data: '[DONE]' });
    } catch (err) {
      logError(`Reimplement prompt error: ${err.message}`);
      console.error(err);
      await stream.writeSSE({ data: JSON.stringify({ error: err.message }) });
    }
  });
});
