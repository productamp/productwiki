/**
 * Global RAG (Retrieval Augmented Generation) Query Module
 * Provides semantic search functionality for all generation tools
 */
import { readFile } from 'fs/promises';
import { join } from 'path';
import { config } from '../config/index.js';
import { embed } from '../providers/index.js';
import { searchSimilar, isIndexed } from './vectorStore.js';

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
 * @param {Array} chunks - Array of chunks from RAG search
 * @param {number} maxChars - Maximum characters for context
 * @returns {string} Formatted context string
 */
export function buildRagContext(chunks, maxChars = MAX_RAG_CONTEXT_CHARS) {
  // Group chunks by file path
  const byPath = new Map();
  for (const chunk of chunks) {
    if (!byPath.has(chunk.path)) {
      byPath.set(chunk.path, []);
    }
    byPath.get(chunk.path).push(chunk);
  }

  let totalChars = 0;
  const contextParts = [];
  let fileIndex = 0;

  for (const [path, fileChunks] of byPath) {
    // Sort chunks by their index within the file
    fileChunks.sort((a, b) => a.chunkIndex - b.chunkIndex);

    const ext = path.split('.').pop() || '';
    const combinedContent = fileChunks.map(c => c.content).join('\n\n---\n\n');

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
  console.log(`[RAG] Built context: ${chunks.length} chunks from ${byPath.size} files, ${result.length} chars (~${Math.ceil(result.length / 4)} tokens)`);
  return result;
}

/**
 * Core RAG query function - embed query and search for similar chunks
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} searchQuery - The search query text
 * @param {Object} options - Options including apiKeys, provider
 * @param {number} limit - Maximum number of chunks to return
 * @returns {Promise<Array>} Array of relevant chunks
 */
export async function queryRag(owner, repo, searchQuery, options = {}, limit = DEFAULT_CHUNK_LIMIT) {
  console.log(`[RAG] Searching for: "${searchQuery.slice(0, 100)}..."`);

  // Embed the query
  const queryVector = await embed(searchQuery, options);

  // Search for similar chunks
  const chunks = await searchSimilar(owner, repo, queryVector, limit);

  console.log(`[RAG] Found ${chunks.length} relevant chunks`);
  return chunks;
}

/**
 * Get context for a specific topic using RAG
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} topic - The topic to search for
 * @param {Object} options - Options including apiKeys, provider
 * @param {number} limit - Maximum number of chunks to return
 * @returns {Promise<{context: string, chunks: Array}>} Context string and raw chunks
 */
export async function getContextForTopic(owner, repo, topic, options = {}, limit = DEFAULT_CHUNK_LIMIT) {
  const chunks = await queryRag(owner, repo, topic, options, limit);
  return {
    context: buildRagContext(chunks),
    chunks,
  };
}

/**
 * Get project metadata from the meta directory
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @returns {Promise<Object|null>} Project metadata or null if not found
 */
export async function getProjectMetadata(owner, repo) {
  try {
    const metaPath = join(config.metaDir, `${owner}_${repo}.json`);
    const content = await readFile(metaPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

// Re-export isIndexed for convenience
export { isIndexed };
