import 'dotenv/config';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { config } from './config/index.js';
import { indexRoutes } from './routes/index.js';
import { projectsRoutes } from './routes/projects.js';
import { generateRoutes } from './routes/generate.js';
import { wikiRoutes } from './routes/wiki.js';
import { logsRoutes } from './routes/logs.js';
import { mkdir } from 'fs/promises';

const app = new Hono();

// Middleware
app.use('*', logger());
app.use('*', cors());

// Extract API key, provider, and model from headers into context
app.use('*', async (c, next) => {
  c.set('apiKey', c.req.header('x-api-key'));
  c.set('llmProvider', c.req.header('x-llm-provider'));
  c.set('geminiModel', c.req.header('x-gemini-model'));
  await next();
});

// Ensure data directories exist
await mkdir(config.reposDir, { recursive: true });
await mkdir(config.vectorsDir, { recursive: true });
await mkdir(config.metaDir, { recursive: true });

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Register routes
app.route('/', indexRoutes);
app.route('/', projectsRoutes);
app.route('/', generateRoutes);
app.route('/', wikiRoutes);
app.route('/', logsRoutes);

// Start server
serve({
  fetch: app.fetch,
  port: config.port,
  hostname: '0.0.0.0',
}, (info) => {
  console.log(`Server running at http://localhost:${info.port}`);
});
