import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from './config/index.js';
import { indexRoutes } from './routes/index.js';
import { projectsRoutes } from './routes/projects.js';
import { generateRoutes } from './routes/generate.js';
import { logsRoutes } from './routes/logs.js';
import { mkdir } from 'fs/promises';

const fastify = Fastify({
  logger: true,
});

// Register CORS
await fastify.register(cors, {
  origin: true,
});

// Ensure data directories exist
await mkdir(config.reposDir, { recursive: true });
await mkdir(config.vectorsDir, { recursive: true });
await mkdir(config.metaDir, { recursive: true });

// Extract API key, provider, and model from headers
fastify.addHook('preHandler', async (request) => {
  const apiKey = request.headers['x-api-key'];
  const provider = request.headers['x-llm-provider'];
  const geminiModel = request.headers['x-gemini-model'];
  if (apiKey) {
    request.apiKey = apiKey;
  }
  if (provider) {
    request.llmProvider = provider;
  }
  if (geminiModel) {
    request.geminiModel = geminiModel;
  }
});

// Health check
fastify.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Register routes
fastify.register(indexRoutes);
fastify.register(projectsRoutes);
fastify.register(generateRoutes);
fastify.register(logsRoutes);

// Start server
try {
  await fastify.listen({ port: config.port, host: '0.0.0.0' });
  console.log(`Server running at http://localhost:${config.port}`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
