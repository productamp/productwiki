import { indexRepository } from '../services/indexer.js';
import { isIndexed } from '../services/vectorStore.js';
import { logError } from '../services/errorLog.js';

export async function indexRoutes(fastify) {
  // Trigger indexing
  fastify.post('/index', async (request, reply) => {
    const { url } = request.body;

    if (!url) {
      return reply.status(400).send({ error: 'URL is required' });
    }

    try {
      const result = await indexRepository(url, request.apiKey);
      return result;
    } catch (err) {
      logError(`Index error: ${err.message}`);
      fastify.log.error(err);
      return reply.status(500).send({ error: err.message });
    }
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
