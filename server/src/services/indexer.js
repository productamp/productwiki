import { join } from 'path';
import { writeFile } from 'fs/promises';
import { config } from '../config/index.js';
import { processRepository } from './repository.js';
import { storeEmbeddings } from './vectorStore.js';
import { embedBatchWithProgress, resolvePreset } from '../providers/index.js';

/**
 * Split text into words
 */
function splitIntoWords(text) {
  return text.split(/\s+/).filter(Boolean);
}

/**
 * Chunk a document into overlapping pieces
 */
function chunkDocument(doc) {
  const words = splitIntoWords(doc.content);
  const chunks = [];

  if (words.length <= config.chunkSize) {
    // Document is smaller than chunk size, keep as single chunk
    chunks.push({
      id: `${doc.path}#0`,
      path: doc.path,
      content: doc.content,
      chunkIndex: 0,
      totalChunks: 1,
      extension: doc.extension,
    });
  } else {
    // Split into overlapping chunks
    let start = 0;
    let chunkIndex = 0;

    while (start < words.length) {
      const end = Math.min(start + config.chunkSize, words.length);
      const chunkWords = words.slice(start, end);
      const chunkContent = chunkWords.join(' ');

      chunks.push({
        id: `${doc.path}#${chunkIndex}`,
        path: doc.path,
        content: chunkContent,
        chunkIndex,
        totalChunks: -1, // Will be updated after
        extension: doc.extension,
      });

      chunkIndex++;
      start += config.chunkSize - config.chunkOverlap;

      // Prevent infinite loop
      if (start >= words.length - config.chunkOverlap && end === words.length) {
        break;
      }
    }

    // Update total chunks
    for (const chunk of chunks) {
      chunk.totalChunks = chunks.length;
    }
  }

  return chunks;
}

/**
 * Index a repository (async generator that yields progress events)
 */
export async function* indexRepositoryWithProgress(url, options = {}) {
  const { signal } = options;
  console.log(`Indexing repository: ${url}`);

  // Check for cancellation
  if (signal?.aborted) {
    throw new Error('Indexing cancelled');
  }

  // Fetch files from GitHub API
  yield { phase: 'clone', status: 'started' };
  const { owner, repo, files, branch } = await processRepository(url, config);
  yield { phase: 'clone', status: 'completed' };

  if (signal?.aborted) {
    throw new Error('Indexing cancelled');
  }

  console.log(`Found ${files.length} files to index`);
  yield { phase: 'extract', status: 'completed', fileCount: files.length };

  // Chunk all documents
  const allChunks = [];
  for (const file of files) {
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

  // Save metadata with embedding info
  const metadata = {
    owner,
    repo,
    url,
    branch,
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

  console.log(`Indexing complete for ${owner}/${repo}`);

  yield { phase: 'complete', metadata };
  return metadata;
}

/**
 * Index a repository (non-streaming, for backward compatibility)
 */
export async function indexRepository(url, options = {}) {
  const generator = indexRepositoryWithProgress(url, options);
  let result;
  // Consume the generator until done
  while (true) {
    const { done, value } = await generator.next();
    if (done) {
      result = value;
      break;
    }
  }
  return result;
}
