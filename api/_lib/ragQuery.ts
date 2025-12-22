/**
 * Global RAG (Retrieval Augmented Generation) Query Module
 * Provides semantic search functionality for all generation tools
 */
import { config } from './config.js';
import { embed } from './embeddings.js';
import { searchSimilar, isIndexed, SearchResult } from './vectorStore.js';
import { KeyEntry } from './api-key-pool.js';

/**
 * Maximum total characters for RAG context
 */
export const MAX_RAG_CONTEXT_CHARS = 30000;

/**
 * Default number of chunks to retrieve from RAG
 */
export const DEFAULT_CHUNK_LIMIT = 20;

/**
 * Build context string from RAG chunks
 * Groups chunks by file path for better organization
 */
export function buildRagContext(chunks: SearchResult[], maxChars: number = MAX_RAG_CONTEXT_CHARS): string {
  // Group chunks by file path
  const byPath = new Map<string, SearchResult[]>();
  for (const chunk of chunks) {
    if (!byPath.has(chunk.path)) {
      byPath.set(chunk.path, []);
    }
    byPath.get(chunk.path)!.push(chunk);
  }

  let totalChars = 0;
  const contextParts: string[] = [];
  let fileIndex = 0;

  for (const [path, fileChunks] of byPath) {
    // Sort chunks by their index within the file
    fileChunks.sort((a, b) => a.chunkIndex - b.chunkIndex);

    const ext = path.split('.').pop() || '';
    const combinedContent = fileChunks.map((c) => c.content).join('\n\n---\n\n');

    const part = `${fileIndex + 1}.\nFile Path: ${path}\nRelevant sections:\n\`\`\`${ext}\n${combinedContent}\n\`\`\``;

    if (totalChars + part.length > maxChars) {
      console.log(`[RAG] Context limit reached at file ${fileIndex + 1}/${byPath.size}`);
      break;
    }

    contextParts.push(part);
    totalChars += part.length;
    fileIndex++;
  }

  const result = contextParts.join('\n\n');
  console.log(
    `[RAG] Built context: ${chunks.length} chunks from ${byPath.size} files, ${result.length} chars (~${Math.ceil(result.length / 4)} tokens)`
  );
  return result;
}

export interface QueryOptions {
  apiKeys?: (string | KeyEntry)[];
}

/**
 * Core RAG query function - embed query and search for similar chunks
 */
export async function queryRag(
  owner: string,
  repo: string,
  searchQuery: string,
  options: QueryOptions = {},
  limit: number = DEFAULT_CHUNK_LIMIT
): Promise<SearchResult[]> {
  console.log(`[RAG] Searching for: "${searchQuery.slice(0, 100)}..."`);

  // Embed the query
  const queryVector = await embed(searchQuery, options.apiKeys);

  // Search for similar chunks
  const chunks = await searchSimilar(owner, repo, queryVector, limit);

  console.log(`[RAG] Found ${chunks.length} relevant chunks`);
  return chunks;
}

/**
 * Get context for a specific topic using RAG
 */
export async function getContextForTopic(
  owner: string,
  repo: string,
  topic: string,
  options: QueryOptions = {},
  limit: number = DEFAULT_CHUNK_LIMIT
): Promise<{ context: string; chunks: SearchResult[] }> {
  const chunks = await queryRag(owner, repo, topic, options, limit);
  return {
    context: buildRagContext(chunks),
    chunks,
  };
}

// Re-export isIndexed for convenience
export { isIndexed };
