import { indexRepository, indexRepositoryWithProgress } from '../services/indexer.js';
import { isIndexed } from '../services/vectorStore.js';
import { logError } from '../services/errorLog.js';

export async function indexRoutes(fastify) {
  // Trigger indexing with SSE progress stream
  fastify.post('/index', async (request, reply) => {
    const { url } = request.body;

    if (!url) {
      return reply.status(400).send({ error: 'URL is required' });
    }

    // Set up SSE headers
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    // Track if client disconnected
    let aborted = false;
    const abortSignal = { aborted: false };

    request.raw.on('close', () => {
      aborted = true;
      abortSignal.aborted = true;
    });

    const sendEvent = (data) => {
      if (!aborted) {
        reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
      }
    };

    try {
      const options = {
        apiKey: request.apiKey,
        provider: request.llmProvider,
        signal: abortSignal,
      };

      const generator = indexRepositoryWithProgress(url, options);

      while (true) {
        const { done, value } = await generator.next();
        if (done) {
          break;
        }
        sendEvent(value);
      }

      sendEvent({ phase: 'done' });
    } catch (err) {
      logError(`Index error: ${err.message}`);
      fastify.log.error(err);

      if (err.message === 'Indexing cancelled') {
        sendEvent({ phase: 'cancelled' });
      } else {
        sendEvent({ phase: 'error', error: err.message });
      }
    } finally {
      reply.raw.end();
    }

    return reply;
  });

  // Check index status
  fastify.get('/index/status/:owner/:repo', async (request, reply) => {
    const { owner, repo } = request.params;

    try {
      const indexed = await isIndexed(owner, repo);
      return { indexed };
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send({ error: err.message });
    }
  });
}
