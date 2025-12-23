import { config } from '../config/index.js';
import { logError } from '../services/errorLog.js';
import { sleep } from './api-key-pool.js';

const JINA_API_URL = 'https://api.jina.ai/v1/embeddings';
const JINA_MODEL = 'jina-code-embeddings-0.5b';
const JINA_EMBEDDING_DIMENSIONS = 896;

const MAX_NETWORK_RETRIES = 3;
const MAX_BATCH_SIZE = 100; // Jina API batch limit

/**
 * Check if error is a rate limit error
 */
function isRateLimitError(err) {
  if (!err) return false;
  const message = (err.message || '').toLowerCase();
  const status = err.status || err.statusCode;

  if (status === 429 || status === 503) return true;

  return message.includes('rate limit') ||
    message.includes('quota') ||
    message.includes('too many requests');
}

/**
 * Check if error is a transient network error
 */
function isNetworkError(err) {
  const message = err?.message?.toLowerCase() || '';
  return message.includes('fetch failed') ||
    message.includes('network') ||
    message.includes('econnreset') ||
    message.includes('econnrefused') ||
    message.includes('etimedout') ||
    message.includes('socket hang up');
}

/**
 * Get Jina API key (from parameter or config fallback)
 */
function getApiKey(apiKey) {
  const key = apiKey || config.jinaApiKey;
  if (!key) {
    throw new Error('Jina API key is required. Set JINA_API_KEY environment variable.');
  }
  return key;
}

/**
 * Call Jina embedding API for a batch of texts
 * @param {string[]} texts - Array of texts to embed
 * @param {string} apiKey - Jina API key
 * @returns {Promise<number[][]>} Array of embedding vectors
 */
async function callJinaApi(texts, apiKey) {
  const response = await fetch(JINA_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: JINA_MODEL,
      input: texts,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    const error = new Error(`Jina API error: ${response.status} ${response.statusText} - ${errorBody}`);
    error.status = response.status;
    throw error;
  }

  const result = await response.json();
  // Sort by index to ensure order matches input
  const sorted = result.data.sort((a, b) => a.index - b.index);
  return sorted.map(item => item.embedding);
}

/**
 * Embed a single text
 * @param {string} text - Text to embed
 * @param {string} apiKey - Jina API key (optional, uses config fallback)
 * @returns {Promise<number[]>} Embedding vector
 */
export async function embed(text, apiKey) {
  const key = getApiKey(apiKey);
  let networkRetries = 0;

  while (true) {
    try {
      const embeddings = await callJinaApi([text], key);
      return embeddings[0];
    } catch (err) {
      if (isRateLimitError(err)) {
        logError(`Jina rate limit hit, waiting 30s...`);
        await sleep(30000);
        continue;
      }
      if (isNetworkError(err) && networkRetries < MAX_NETWORK_RETRIES) {
        networkRetries++;
        console.log(`[Jina] Network error, retrying (${networkRetries}/${MAX_NETWORK_RETRIES})...`);
        await sleep(1000 * networkRetries);
        continue;
      }
      logError(`Jina embed error: ${err.message}`);
      throw err;
    }
  }
}

/**
 * Embed multiple texts with progress reporting
 * @param {string[]} texts - Array of texts to embed
 * @param {string} apiKey - Jina API key (optional, uses config fallback)
 * @param {AbortSignal} signal - Abort signal for cancellation
 * @yields {{ current: number, total: number }} Progress updates
 * @returns {number[][]} Array of embedding vectors
 */
export async function* embedBatchWithProgress(texts, apiKey, signal) {
  const key = getApiKey(apiKey);
  const embeddings = [];
  const batchSize = Math.min(MAX_BATCH_SIZE, config.embeddingBatchSize || 50);

  for (let i = 0; i < texts.length; i += batchSize) {
    // Check for cancellation
    if (signal?.aborted) {
      throw new Error('Indexing cancelled');
    }

    const batch = texts.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(texts.length / batchSize);
    console.log(`[Jina] Embedding batch ${batchNum}/${totalBatches} (${batch.length} texts)`);

    let networkRetries = 0;

    while (true) {
      try {
        const batchEmbeddings = await callJinaApi(batch, key);
        embeddings.push(...batchEmbeddings);
        break;
      } catch (err) {
        if (isRateLimitError(err)) {
          logError(`Jina rate limit hit on batch ${batchNum}, waiting 30s...`);
          await sleep(30000);
          continue;
        }
        if (isNetworkError(err) && networkRetries < MAX_NETWORK_RETRIES) {
          networkRetries++;
          console.log(`[Jina] Network error on batch ${batchNum}, retrying (${networkRetries}/${MAX_NETWORK_RETRIES})...`);
          await sleep(1000 * networkRetries);
          continue;
        }
        const errorMsg = `Jina embed error on batch ${batchNum}: ${err.message}`;
        logError(errorMsg);
        throw new Error(`Embedding failed after ${MAX_NETWORK_RETRIES} retries: ${err.message}`);
      }
    }

    // Yield progress after each batch
    yield { current: Math.min(i + batchSize, texts.length), total: texts.length };
  }

  return embeddings;
}

/**
 * Embed multiple texts (non-generator version)
 * @param {string[]} texts - Array of texts to embed
 * @param {string} apiKey - Jina API key (optional, uses config fallback)
 * @returns {Promise<number[][]>} Array of embedding vectors
 */
export async function embedBatch(texts, apiKey) {
  const generator = embedBatchWithProgress(texts, apiKey);
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

/**
 * Get embedding dimensions for Jina model
 * @returns {number}
 */
export function getEmbeddingDimensions() {
  return JINA_EMBEDDING_DIMENSIONS;
}
