/**
 * Repository indexer service
 * Handles fetching, chunking, embedding, and storing repository content
 */
import { config } from './config.js';
import { processRepository, GitHubFile } from './github.js';
import { storeEmbeddings, saveProjectMetadata, Chunk } from './vectorStore.js';
import { embedBatchWithProgress } from './embeddings.js';
import { KeyEntry } from './api-key-pool.js';

interface ChunkData {
  id: string;
  path: string;
  content: string;
  chunkIndex: number;
  totalChunks: number;
  extension: string;
}

/**
 * Split text into words
 */
function splitIntoWords(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

/**
 * Chunk a document into overlapping pieces
 */
export function chunkDocument(doc: GitHubFile): ChunkData[] {
  const words = splitIntoWords(doc.content);
  const chunks: ChunkData[] = [];

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

export interface IndexProgress {
  phase: 'clone' | 'extract' | 'chunk' | 'embed' | 'store' | 'complete' | 'done' | 'cancelled' | 'error';
  status?: string;
  fileCount?: number;
  chunkCount?: number;
  current?: number;
  total?: number;
  metadata?: {
    owner: string;
    repo: string;
    url: string;
    branch: string;
    indexedAt: string;
    fileCount: number;
    chunkCount: number;
  };
  error?: string;
}

export interface IndexOptions {
  apiKeys?: (string | KeyEntry)[];
  signal?: { aborted: boolean };
}

/**
 * Index a repository (async generator that yields progress events)
 */
export async function* indexRepositoryWithProgress(
  url: string,
  options: IndexOptions = {}
): AsyncGenerator<IndexProgress> {
  const { signal, apiKeys } = options;
  console.log(`Indexing repository: ${url}`);

  if (signal?.aborted) {
    throw new Error('Indexing cancelled');
  }

  // Fetch files from GitHub API
  yield { phase: 'clone', status: 'started' };
  const { owner, repo, files, branch } = await processRepository(url);
  yield { phase: 'clone', status: 'completed' };

  if (signal?.aborted) {
    throw new Error('Indexing cancelled');
  }

  console.log(`Found ${files.length} files to index`);
  yield { phase: 'extract', status: 'completed', fileCount: files.length };

  // Chunk all documents
  const allChunks: ChunkData[] = [];
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
  const embeddingGenerator = embedBatchWithProgress(texts, apiKeys, signal);
  let embeddings: number[][] = [];

  while (true) {
    const { done, value } = await embeddingGenerator.next();
    if (done) {
      embeddings = value as number[][];
      break;
    }
    // Yield embedding progress
    yield { phase: 'embed', status: 'progress', current: value.current, total: value.total };
  }
  yield { phase: 'embed', status: 'completed' };

  // Attach embeddings to chunks
  const chunksWithVectors: Chunk[] = allChunks.map((chunk, i) => ({
    ...chunk,
    vector: embeddings[i],
  }));

  if (signal?.aborted) {
    throw new Error('Indexing cancelled');
  }

  // Store in vector database
  yield { phase: 'store', status: 'started', progress: { current: 0, total: chunksWithVectors.length } };
  await storeEmbeddings(owner, repo, chunksWithVectors, (current, total) => {
    // Note: We can't yield here since we're in a callback, but the console logs help debugging
  });
  yield { phase: 'store', status: 'completed', progress: { current: chunksWithVectors.length, total: chunksWithVectors.length } };

  // Save metadata
  const metadata = {
    owner,
    repo,
    url,
    branch,
    indexedAt: new Date().toISOString(),
    fileCount: files.length,
    chunkCount: allChunks.length,
    embedding: {
      provider: 'gemini',
      model: config.embeddingModel,
      dimensions: config.embeddingDimensions,
    },
  };

  await saveProjectMetadata(owner, repo, metadata);

  console.log(`Indexing complete for ${owner}/${repo}`);

  yield { phase: 'complete', metadata };
  return metadata;
}

/**
 * Index a repository (non-streaming)
 */
export async function indexRepository(url: string, options: IndexOptions = {}) {
  const generator = indexRepositoryWithProgress(url, options);
  let result;

  while (true) {
    const { done, value } = await generator.next();
    if (done) {
      result = value;
      break;
    }
  }

  return result;
}
