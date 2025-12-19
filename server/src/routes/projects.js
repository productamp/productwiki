import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { config } from '../config/index.js';

export async function projectsRoutes(fastify) {
  // List all indexed projects
  fastify.get('/projects', async (request, reply) => {
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
            fastify.log.warn(`Failed to read metadata file ${file}:`, err.message);
          }
        }
      }

      // Sort by indexedAt descending
      projects.sort((a, b) => new Date(b.indexedAt) - new Date(a.indexedAt));

      return projects;
    } catch (err) {
      // Directory might not exist yet
      if (err.code === 'ENOENT') {
        return [];
      }
      fastify.log.error(err);
      return reply.status(500).send({ error: err.message });
    }
  });

  // Get single project metadata
  fastify.get('/projects/:owner/:repo', async (request, reply) => {
    const { owner, repo } = request.params;

    try {
      const metaPath = join(config.metaDir, `${owner}_${repo}.json`);
      const content = await readFile(metaPath, 'utf-8');
      return JSON.parse(content);
    } catch (err) {
      if (err.code === 'ENOENT') {
        return reply.status(404).send({ error: 'Project not found' });
      }
      fastify.log.error(err);
      return reply.status(500).send({ error: err.message });
    }
  });
}
