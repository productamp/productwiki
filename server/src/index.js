import 'dotenv/config';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { config } from './config/index.js';
import { indexRoutes } from './routes/index.js';
import { projectsRoutes } from './routes/projects.js';
import { generateRoutes } from './routes/generate.js';
import { wikiRoutes } from './routes/wiki.js';
import { logsRoutes } from './routes/logs.js';
import { jobsRoutes } from './routes/jobs.js';
import { mkdir } from 'fs/promises';

const app = new Hono();

// Middleware
app.use('*', logger());
app.use('*', cors());

// Extract preset and API keys from headers into context
app.use('*', async (c, next) => {
  // Preset (new system)
  const presetHeader = c.req.header('x-preset');
  c.set('preset', presetHeader || null);

  // Google API keys (for gemini/gemma presets)
  const apiKeysHeader = c.req.header('x-api-keys');
  let apiKeys = [];
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
  c.set('apiKeys', apiKeys);
  c.set('apiKey', apiKeys[0] || null); // Keep for backwards compat

  // Groq API keys (for best-free-cloud preset, optional - server has fallback)
  const groqApiKeysHeader = c.req.header('x-groq-api-keys');
  let groqApiKeys = [];
  if (groqApiKeysHeader) {
    try {
      groqApiKeys = JSON.parse(groqApiKeysHeader);
    } catch {
      groqApiKeys = [];
    }
  }
  c.set('groqApiKeys', groqApiKeys);

  // TPM rate limit settings (for gemini/gemma presets)
  c.set('lowTpmMode', c.req.header('x-low-tpm-mode') === 'true');
  c.set('tpmLimit', parseInt(c.req.header('x-tpm-limit') || '0', 10) || 15000);

  await next();
});

// Ensure data directories exist
await mkdir(config.vectorsDir, { recursive: true });
await mkdir(config.metaDir, { recursive: true });

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Register API routes
app.route('/', indexRoutes);
app.route('/', projectsRoutes);
app.route('/', generateRoutes);
app.route('/', wikiRoutes);
app.route('/', logsRoutes);
app.route('/', jobsRoutes);

// Serve static files from dist directory
app.use('/*', serveStatic({ root: '../dist' }));

// Fallback to index.html for client-side routing
app.get('*', serveStatic({ path: '../dist/index.html' }));

// Start server
serve({
  fetch: app.fetch,
  port: config.port,
  hostname: '0.0.0.0',
}, (info) => {
  console.log(`Server running at http://localhost:${info.port}`);
});
