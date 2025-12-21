import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config/index.js';
import { logError } from '../services/errorLog.js';
import { getKeyPool, isRateLimitError, sleep } from './api-key-pool.js';

const MAX_NETWORK_RETRIES = 3;
const MAX_CONCURRENCY = config.embeddingConcurrency || 5;

/**
 * Run async functions with limited concurrency
 * @param {Function[]} tasks - Array of async functions to execute
 * @param {number} concurrency - Max parallel executions
 * @returns {Promise<any[]>} Results in order
 */
async function runWithConcurrency(tasks, concurrency) {
  const results = new Array(tasks.length);
  let index = 0;

  async function worker() {
    while (index < tasks.length) {
      const currentIndex = index++;
      results[currentIndex] = await tasks[currentIndex]();
    }
  }

  // Start workers up to concurrency limit
  const workers = [];
  for (let i = 0; i < Math.min(concurrency, tasks.length); i++) {
    workers.push(worker());
  }

  await Promise.all(workers);
  return results;
}

/**
 * Check if error is a transient network error that should be retried
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
 * Get embedding model for a specific API key
 */
function getClient(apiKey) {
  const key = apiKey || process.env.GOOGLE_API_KEY;
  if (!key) {
    throw new Error('Google API key is required. Set it in Settings or GOOGLE_API_KEY environment variable.');
  }
  const genAI = new GoogleGenerativeAI(key);
  return genAI.getGenerativeModel({ model: config.embeddingModel });
}

/**
 * Normalize API keys to array with env fallback
 */
function normalizeKeys(apiKeys) {
  const keys = Array.isArray(apiKeys) ? apiKeys : [apiKeys].filter(Boolean);
  if (keys.length === 0 && process.env.GOOGLE_API_KEY) {
    keys.push(process.env.GOOGLE_API_KEY);
  }
  if (keys.length === 0) {
    throw new Error('Google API key is required. Set it in Settings or GOOGLE_API_KEY environment variable.');
  }
  return keys;
}

/**
 * Embed a single text with key rotation and cooldown
 */
export async function embed(text, apiKeys) {
  const keys = normalizeKeys(apiKeys);
  const pool = getKeyPool('embeddings', keys);
  let networkRetries = 0;

  while (true) {
    const available = pool.getAvailableKey();

    if (!available) {
      // All keys in cooldown - throw error instead of waiting
      const waitTime = pool.getTimeUntilAvailable();
      const keysInCooldown = pool.getKeysInCooldown();
      const waitSeconds = Math.ceil(waitTime / 1000);
      const errorMsg = `All ${keysInCooldown} API key(s) rate limited. Try again in ${waitSeconds}s or add more API keys in Settings.`;
      logError(errorMsg);
      throw new Error(errorMsg);
    }

    const { key, label, index } = available;

    try {
      const model = getClient(key);
      const result = await model.embedContent(text);
      return result.embedding.values;
    } catch (err) {
      if (isRateLimitError(err)) {
        pool.markRateLimited(index);
        logError(`Rate limit hit on "${label}" (${index + 1}/${pool.getKeyCount()}), cooldown started`);
        continue;
      }
      // Retry network errors
      if (isNetworkError(err) && networkRetries < MAX_NETWORK_RETRIES) {
        networkRetries++;
        console.log(`[Embed] Network error on "${label}", retrying (${networkRetries}/${MAX_NETWORK_RETRIES})...`);
        await sleep(1000 * networkRetries);
        continue;
      }
      throw err;
    }
  }
}

/**
 * Embed multiple texts in batches (async generator with progress)
 * Supports key rotation with cooldown when rate limited
 */
export async function* embedBatchWithProgress(texts, apiKeys, signal) {
  const keys = normalizeKeys(apiKeys);
  const pool = getKeyPool('embeddings', keys);
  const embeddings = [];

  // Process in batches
  for (let i = 0; i < texts.length; i += config.embeddingBatchSize) {
    // Check for cancellation
    if (signal?.aborted) {
      throw new Error('Indexing cancelled');
    }

    const batch = texts.slice(i, i + config.embeddingBatchSize);
    console.log(`Embedding batch ${Math.floor(i / config.embeddingBatchSize) + 1}/${Math.ceil(texts.length / config.embeddingBatchSize)}`);

    // Process batch with concurrency limit to avoid overwhelming connections
    const tasks = batch.map((text) => async () => {
      let networkRetries = 0;
      while (true) {
        const available = pool.getAvailableKey();

        if (!available) {
          // All keys in cooldown - throw error instead of waiting
          const waitTime = pool.getTimeUntilAvailable();
          const keysInCooldown = pool.getKeysInCooldown();
          const waitSeconds = Math.ceil(waitTime / 1000);
          const errorMsg = `All ${keysInCooldown} API key(s) rate limited. Try again in ${waitSeconds}s or add more API keys in Settings.`;
          logError(errorMsg);
          throw new Error(errorMsg);
        }

        const { key, label, index } = available;

        try {
          const model = getClient(key);
          const result = await model.embedContent(text);
          return result.embedding.values;
        } catch (err) {
          if (isRateLimitError(err)) {
            pool.markRateLimited(index);
            logError(`Rate limit on "${label}" (${index + 1}/${pool.getKeyCount()}), cooldown started`);
            continue;
          }
          // Retry network errors
          if (isNetworkError(err) && networkRetries < MAX_NETWORK_RETRIES) {
            networkRetries++;
            console.log(`[Embed] Network error on "${label}", retrying (${networkRetries}/${MAX_NETWORK_RETRIES})...`);
            await sleep(1000 * networkRetries);
            continue;
          }
          // Fail the entire batch - don't store corrupted zero vectors
          const errorMsg = `Embed error on "${label}": ${err.message}`;
          logError(errorMsg);
          throw new Error(`Embedding failed after ${MAX_NETWORK_RETRIES} retries: ${err.message}`);
        }
      }
    });

    const batchResults = await runWithConcurrency(tasks, MAX_CONCURRENCY);

    embeddings.push(...batchResults);

    // Yield progress after each batch
    yield { current: Math.min(i + config.embeddingBatchSize, texts.length), total: texts.length };
  }

  return embeddings;
}

/**
 * Embed multiple texts in batches
 */
export async function embedBatch(texts, apiKeys) {
  const generator = embedBatchWithProgress(texts, apiKeys);
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
