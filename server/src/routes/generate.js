import { generateDocumentation, generatePackagePrompt, generateReimplementPrompt } from '../services/rag.js';
import { logError } from '../services/errorLog.js';

export async function generateRoutes(fastify) {
  // Generate documentation (SSE streaming)
  fastify.post('/generate/docs', async (request, reply) => {
    const { owner, repo } = request.body;

    if (!owner || !repo) {
      return reply.status(400).send({ error: 'Owner and repo are required' });
    }

    // Set SSE headers
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    try {
      for await (const chunk of generateDocumentation(owner, repo, request.apiKey)) {
        const data = JSON.stringify({ content: chunk });
        reply.raw.write(`data: ${data}\n\n`);
      }

      reply.raw.write('data: [DONE]\n\n');
    } catch (err) {
      logError(`Generate error: ${err.message}`);
      fastify.log.error(err);
      const errorData = JSON.stringify({ error: err.message });
      reply.raw.write(`data: ${errorData}\n\n`);
    }

    reply.raw.end();
  });

  // Generate package/migration prompt (SSE streaming)
  fastify.post('/generate/package-prompt', async (request, reply) => {
    const { owner, repo } = request.body;

    if (!owner || !repo) {
      return reply.status(400).send({ error: 'Owner and repo are required' });
    }

    // Set SSE headers
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    try {
      for await (const chunk of generatePackagePrompt(owner, repo, request.apiKey)) {
        const data = JSON.stringify({ content: chunk });
        reply.raw.write(`data: ${data}\n\n`);
      }

      reply.raw.write('data: [DONE]\n\n');
    } catch (err) {
      logError(`Package prompt error: ${err.message}`);
      fastify.log.error(err);
      const errorData = JSON.stringify({ error: err.message });
      reply.raw.write(`data: ${errorData}\n\n`);
    }

    reply.raw.end();
  });

  // Generate reimplement prompt (SSE streaming)
  fastify.post('/generate/reimplement-prompt', async (request, reply) => {
    const { owner, repo } = request.body;

    if (!owner || !repo) {
      return reply.status(400).send({ error: 'Owner and repo are required' });
    }

    // Set SSE headers
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    try {
      for await (const chunk of generateReimplementPrompt(owner, repo, request.apiKey)) {
        const data = JSON.stringify({ content: chunk });
        reply.raw.write(`data: ${data}\n\n`);
      }

      reply.raw.write('data: [DONE]\n\n');
    } catch (err) {
      logError(`Reimplement prompt error: ${err.message}`);
      fastify.log.error(err);
      const errorData = JSON.stringify({ error: err.message });
      reply.raw.write(`data: ${errorData}\n\n`);
    }

    reply.raw.end();
  });
}
