import { Hono } from 'hono';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { config } from '../config/index.js';

/**
 * Get current embedding config based on provider
 */
function getCurrentEmbeddingConfig(provider) {
  if (provider === 'ollama') {
    return {
      provider: 'ollama',
      model: config.ollamaEmbeddingModel,
      dimensions: config.ollamaEmbeddingDimensions,
    };
  }
  return {
    provider: 'gemini',
    model: config.embeddingModel,
    dimensions: config.embeddingDimensions,
  };
}

/**
 * Check if project embedding is compatible with current settings
 */
function checkEmbeddingCompatibility(projectEmbedding, currentEmbedding) {
  if (!projectEmbedding) {
    return {
      compatible: false,
      reason: 'Project was indexed before embedding tracking was added. Re-index recommended.',
    };
  }

  if (projectEmbedding.provider !== currentEmbedding.provider) {
    return {
      compatible: false,
      reason: `Project was indexed with ${projectEmbedding.provider}, but current provider is ${currentEmbedding.provider}.`,
    };
  }

  if (projectEmbedding.model !== currentEmbedding.model) {
    return {
      compatible: false,
      reason: `Project was indexed with ${projectEmbedding.model}, but current model is ${currentEmbedding.model}.`,
    };
  }

  return { compatible: true };
}

export const projectsRoutes = new Hono();

// List all indexed projects
projectsRoutes.get('/projects', async (c) => {
  try {
    const files = await readdir(config.metaDir);
    const projects = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const content = await readFile(join(config.metaDir, file), 'utf-8');
          const metadata = JSON.parse(content);
          projects.push(metadata);
        } catch (err) {
          console.warn(`Failed to read metadata file ${file}:`, err.message);
        }
      }
    }

    // Sort by indexedAt descending
    projects.sort((a, b) => new Date(b.indexedAt) - new Date(a.indexedAt));

    return c.json(projects);
  } catch (err) {
    // Directory might not exist yet
    if (err.code === 'ENOENT') {
      return c.json([]);
    }
    console.error(err);
    return c.json({ error: err.message }, 500);
  }
});

// Get single project metadata with compatibility check
projectsRoutes.get('/projects/:owner/:repo', async (c) => {
  const { owner, repo } = c.req.param();

  try {
    const metaPath = join(config.metaDir, `${owner}_${repo}.json`);
    const content = await readFile(metaPath, 'utf-8');
    const metadata = JSON.parse(content);

    // Check embedding compatibility with current provider
    const currentProvider = c.get('llmProvider') || config.llmProvider;
    const currentEmbedding = getCurrentEmbeddingConfig(currentProvider);
    const compatibility = checkEmbeddingCompatibility(metadata.embedding, currentEmbedding);

    return c.json({
      ...metadata,
      embeddingCompatibility: compatibility,
    });
  } catch (err) {
    if (err.code === 'ENOENT') {
      return c.json({ error: 'Project not found' }, 404);
    }
    console.error(err);
    return c.json({ error: err.message }, 500);
  }
});
