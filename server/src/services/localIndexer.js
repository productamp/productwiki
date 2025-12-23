import { join } from 'path';
import { writeFile } from 'fs/promises';
import { config } from '../config/index.js';
import { chunkDocument } from './indexer.js';
import { storeEmbeddings } from './vectorStore.js';
import { embedBatchWithProgress, resolvePreset } from '../providers/index.js';

/**
 * Sanitize project name for use as repo identifier
 */
function sanitizeProjectName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Index local files (async generator that yields progress events)
 * @param {string} projectName - User-provided project name
 * @param {Array<{path: string, content: string}>} files - Pre-filtered files from client
 * @param {object} options - Standard indexing options
 */
export async function* indexLocalFilesWithProgress(projectName, files, options = {}) {
  const { signal } = options;
  const owner = 'local';
  const repo = sanitizeProjectName(projectName);

  console.log(`Indexing local directory: ${projectName} (${files.length} files)`);

  // Check for cancellation
  if (signal?.aborted) {
    throw new Error('Indexing cancelled');
  }

  // Skip clone phase - files already provided
  yield { phase: 'clone', status: 'started' };
  yield { phase: 'clone', status: 'completed' };

  // Add extension to files
  const processedFiles = files.map(f => ({
    ...f,
    extension: f.path.includes('.') ? '.' + f.path.split('.').pop().toLowerCase() : '',
  }));

  console.log(`Processing ${processedFiles.length} files`);
  yield { phase: 'extract', status: 'completed', fileCount: processedFiles.length };

  if (signal?.aborted) {
    throw new Error('Indexing cancelled');
  }

  // Chunk all documents
  const allChunks = [];
  for (const file of processedFiles) {
    const chunks = chunkDocument(file);
    allChunks.push(...chunks);
  }

  console.log(`Created ${allChunks.length} chunks`);
  yield { phase: 'chunk', status: 'completed', chunkCount: allChunks.length };

  if (signal?.aborted) {
    throw new Error('Indexing cancelled');
  }

  // Embed all chunks with progress
  const texts = allChunks.map((chunk) => chunk.content);
  const embeddingGenerator = embedBatchWithProgress(texts, options);
  let embeddings;

  while (true) {
    const { done, value } = await embeddingGenerator.next();
    if (done) {
      embeddings = value;
      break;
    }
    // Yield embedding progress
    yield { phase: 'embed', status: 'progress', current: value.current, total: value.total };
  }
  yield { phase: 'embed', status: 'completed' };

  // Attach embeddings to chunks
  for (let i = 0; i < allChunks.length; i++) {
    allChunks[i].vector = embeddings[i];
  }

  if (signal?.aborted) {
    throw new Error('Indexing cancelled');
  }

  // Store in vector database
  yield { phase: 'store', status: 'started' };
  await storeEmbeddings(owner, repo, allChunks);
  yield { phase: 'store', status: 'completed' };

  // Determine embedding info from preset
  const preset = resolvePreset(options);
  const embeddingProvider = preset.embedding.provider;
  const embeddingModel = preset.embedding.model;
  const embeddingDimensions = preset.embedding.dimensions;

  // Save metadata with local-specific fields
  const metadata = {
    owner,
    repo,
    url: `local://${repo}`,
    source: 'local',
    indexedAt: new Date().toISOString(),
    fileCount: files.length,
    chunkCount: allChunks.length,
    embedding: {
      provider: embeddingProvider,
      model: embeddingModel,
      dimensions: embeddingDimensions,
    },
    preset: preset.id,
  };

  const metaPath = join(config.metaDir, `${owner}_${repo}.json`);
  await writeFile(metaPath, JSON.stringify(metadata, null, 2));

  console.log(`Indexing complete for local/${repo}`);

  yield { phase: 'complete', metadata };
  return metadata;
}
