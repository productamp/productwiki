/**
 * Upstash Vector store implementation
 * Replaces LanceDB for serverless-compatible vector storage
 */
import { Index } from '@upstash/vector';
import { config } from './config.js';

// Types
export interface Chunk {
  id: string;
  path: string;
  content: string;
  chunkIndex: number;
  totalChunks: number;
  extension: string;
  vector: number[];
}

export interface SearchResult {
  id: string;
  path: string;
  content: string;
  chunkIndex: number;
  totalChunks: number;
  extension: string;
  distance: number;
}

export interface ProjectMetadata {
  owner: string;
  repo: string;
  url: string;
  branch: string;
  indexedAt: string;
  fileCount: number;
  chunkCount: number;
  embedding: {
    provider: string;
    model: string;
    dimensions: number;
  };
}

// Lazy-initialized index
let index: Index | null = null;

function getIndex(): Index {
  if (!index) {
    const url = process.env.UPSTASH_VECTOR_REST_URL;
    const token = process.env.UPSTASH_VECTOR_REST_TOKEN;

    if (!url || !token) {
      throw new Error('UPSTASH_VECTOR_REST_URL and UPSTASH_VECTOR_REST_TOKEN must be set');
    }

    index = new Index({ url, token });
  }
  return index;
}

/**
 * Generate a unique vector ID for a chunk
 */
function getVectorId(owner: string, repo: string, chunkId: string): string {
  return `${owner}_${repo}_${chunkId}`.replace(/[^a-zA-Z0-9_#-]/g, '_');
}

/**
 * Check if a repository is indexed
 */
export async function isIndexed(owner: string, repo: string): Promise<boolean> {
  try {
    const idx = getIndex();

    // Check for metadata vector
    const metadataId = `${owner}_${repo}_metadata`;
    const results = await idx.fetch([metadataId], { includeMetadata: true });

    return results.length > 0 && results[0] !== null;
  } catch (error) {
    console.error('[VectorStore] Error checking if indexed:', error);
    return false;
  }
}

/**
 * Store embeddings in Upstash Vector
 */
export async function storeEmbeddings(
  owner: string,
  repo: string,
  chunks: Chunk[],
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  const idx = getIndex();

  // Delete existing vectors for this repo first
  console.log(`[VectorStore] Deleting existing vectors for ${owner}/${repo}...`);

  try {
    // Delete by filter - remove all vectors for this repo
    await idx.delete({
      filter: `owner = '${owner}' AND repo = '${repo}'`,
    });
  } catch (error) {
    // Filter delete might fail if no vectors exist, that's OK
    console.log('[VectorStore] No existing vectors to delete or filter not supported');
  }

  // Upsert in batches with parallel processing for speed
  const BATCH_SIZE = 200;
  const PARALLEL_BATCHES = 3; // Process 3 batches in parallel
  const totalBatches = Math.ceil(chunks.length / BATCH_SIZE);
  console.log(`[VectorStore] Storing ${chunks.length} chunks in ${totalBatches} batches (${PARALLEL_BATCHES} parallel)...`);

  let completed = 0;

  for (let i = 0; i < chunks.length; i += BATCH_SIZE * PARALLEL_BATCHES) {
    // Create parallel batch promises
    const batchPromises = [];

    for (let j = 0; j < PARALLEL_BATCHES; j++) {
      const batchStart = i + (j * BATCH_SIZE);
      if (batchStart >= chunks.length) break;

      const batch = chunks.slice(batchStart, batchStart + BATCH_SIZE);
      const batchNum = Math.floor(batchStart / BATCH_SIZE) + 1;

      const vectors = batch.map((chunk) => ({
        id: getVectorId(owner, repo, chunk.id),
        vector: chunk.vector,
        metadata: {
          owner,
          repo,
          path: chunk.path,
          content: chunk.content,
          chunkIndex: chunk.chunkIndex,
          totalChunks: chunk.totalChunks,
          extension: chunk.extension,
          type: 'chunk',
        },
      }));

      batchPromises.push(
        idx.upsert(vectors).then(() => {
          completed += batch.length;
          console.log(`[VectorStore] Stored batch ${batchNum}/${totalBatches} (${completed}/${chunks.length} chunks)`);
          if (onProgress) {
            onProgress(completed, chunks.length);
          }
        })
      );
    }

    // Wait for all parallel batches to complete
    await Promise.all(batchPromises);
  }

  console.log(`[VectorStore] Successfully stored ${chunks.length} chunks for ${owner}/${repo}`);
}

/**
 * Search for similar chunks
 */
export async function searchSimilar(
  owner: string,
  repo: string,
  queryVector: number[],
  limit: number = 20
): Promise<SearchResult[]> {
  const idx = getIndex();

  const results = await idx.query({
    vector: queryVector,
    topK: limit,
    filter: `owner = '${owner}' AND repo = '${repo}' AND type = 'chunk'`,
    includeMetadata: true,
    includeVectors: false,
  });

  return results.map((r) => ({
    id: r.id as string,
    path: r.metadata?.path as string,
    content: r.metadata?.content as string,
    chunkIndex: r.metadata?.chunkIndex as number,
    totalChunks: r.metadata?.totalChunks as number,
    extension: r.metadata?.extension as string,
    distance: 1 - (r.score || 0), // Convert similarity score to distance
  }));
}

/**
 * Get all chunks for a repository
 */
export async function getAllChunks(owner: string, repo: string): Promise<SearchResult[]> {
  const idx = getIndex();

  // Query with a zero vector to get all matching vectors
  const dummyVector = new Array(config.embeddingDimensions).fill(0);

  const results = await idx.query({
    vector: dummyVector,
    topK: 10000, // Get all chunks
    filter: `owner = '${owner}' AND repo = '${repo}' AND type = 'chunk'`,
    includeMetadata: true,
    includeVectors: false,
  });

  return results.map((r) => ({
    id: r.id as string,
    path: r.metadata?.path as string,
    content: r.metadata?.content as string,
    chunkIndex: r.metadata?.chunkIndex as number,
    totalChunks: r.metadata?.totalChunks as number,
    extension: r.metadata?.extension as string,
    distance: 0,
  }));
}

/**
 * Get chunk count for a repository
 */
export async function getChunkCount(owner: string, repo: string): Promise<number> {
  try {
    const chunks = await getAllChunks(owner, repo);
    return chunks.length;
  } catch {
    return 0;
  }
}

/**
 * Save project metadata as a special vector
 */
export async function saveProjectMetadata(
  owner: string,
  repo: string,
  metadata: ProjectMetadata
): Promise<void> {
  const idx = getIndex();

  // Use a dummy vector for metadata storage
  const dummyVector = new Array(config.embeddingDimensions).fill(0);

  await idx.upsert([{
    id: `${owner}_${repo}_metadata`,
    vector: dummyVector,
    metadata: {
      ...metadata,
      type: 'metadata',
      owner,
      repo,
    },
  }]);

  console.log(`[VectorStore] Saved metadata for ${owner}/${repo}`);
}

/**
 * Get project metadata
 */
export async function getProjectMetadata(
  owner: string,
  repo: string
): Promise<ProjectMetadata | null> {
  try {
    const idx = getIndex();
    const metadataId = `${owner}_${repo}_metadata`;

    const results = await idx.fetch([metadataId], { includeMetadata: true });

    if (results.length === 0 || !results[0]) {
      return null;
    }

    const meta = results[0].metadata as Record<string, unknown>;
    return {
      owner: meta.owner as string,
      repo: meta.repo as string,
      url: meta.url as string,
      branch: meta.branch as string,
      indexedAt: meta.indexedAt as string,
      fileCount: meta.fileCount as number,
      chunkCount: meta.chunkCount as number,
      embedding: meta.embedding as ProjectMetadata['embedding'],
    };
  } catch (error) {
    console.error('[VectorStore] Error getting metadata:', error);
    return null;
  }
}

/**
 * List all indexed projects
 */
export async function listProjects(): Promise<ProjectMetadata[]> {
  try {
    const idx = getIndex();
    const dummyVector = new Array(config.embeddingDimensions).fill(0);

    // Query for all metadata entries
    const results = await idx.query({
      vector: dummyVector,
      topK: 1000,
      filter: `type = 'metadata'`,
      includeMetadata: true,
      includeVectors: false,
    });

    return results.map((r) => {
      const meta = r.metadata as Record<string, unknown>;
      return {
        owner: meta.owner as string,
        repo: meta.repo as string,
        url: meta.url as string,
        branch: meta.branch as string,
        indexedAt: meta.indexedAt as string,
        fileCount: meta.fileCount as number,
        chunkCount: meta.chunkCount as number,
        embedding: meta.embedding as ProjectMetadata['embedding'],
      };
    });
  } catch (error) {
    console.error('[VectorStore] Error listing projects:', error);
    return [];
  }
}

/**
 * Delete all vectors for a repository
 */
export async function deleteRepository(owner: string, repo: string): Promise<void> {
  const idx = getIndex();

  try {
    await idx.delete({
      filter: `owner = '${owner}' AND repo = '${repo}'`,
    });
    console.log(`[VectorStore] Deleted all vectors for ${owner}/${repo}`);
  } catch (error) {
    console.error('[VectorStore] Error deleting repository:', error);
    throw error;
  }
}
