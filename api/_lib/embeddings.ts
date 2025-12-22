/**
 * Embeddings provider using Google text-embedding-004
 */
import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from './config.js';
import { getKeyPool, isRateLimitError, sleep, KeyEntry } from './api-key-pool.js';

const MAX_NETWORK_RETRIES = 3;
const MAX_CONCURRENCY = config.embeddingConcurrency || 5;

/**
 * Run async functions with limited concurrency
 */
async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let index = 0;

  async function worker() {
    while (index < tasks.length) {
      const currentIndex = index++;
      results[currentIndex] = await tasks[currentIndex]();
    }
  }

  const workers: Promise<void>[] = [];
  for (let i = 0; i < Math.min(concurrency, tasks.length); i++) {
    workers.push(worker());
  }

  await Promise.all(workers);
  return results;
}

/**
 * Check if error is a transient network error
 */
function isNetworkError(err: unknown): boolean {
  const message = (err as { message?: string })?.message?.toLowerCase() || '';
  return (
    message.includes('fetch failed') ||
    message.includes('network') ||
    message.includes('econnreset') ||
    message.includes('econnrefused') ||
    message.includes('etimedout') ||
    message.includes('socket hang up')
  );
}

/**
 * Get embedding model for a specific API key
 */
function getClient(apiKey: string) {
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
function normalizeKeys(apiKeys?: (string | KeyEntry)[]): (string | KeyEntry)[] {
  const keys: (string | KeyEntry)[] = Array.isArray(apiKeys)
    ? apiKeys
    : [apiKeys].filter(Boolean) as (string | KeyEntry)[];

  if (keys.length === 0 && process.env.GOOGLE_API_KEY) {
    keys.push(process.env.GOOGLE_API_KEY);
  }

  if (keys.length === 0) {
    throw new Error('Google API key is required. Set it in Settings or GOOGLE_API_KEY environment variable.');
  }

  return keys;
}

/**
 * Log error (simplified for serverless)
 */
function logError(message: string): void {
  console.error(`[Embeddings Error] ${message}`);
}

/**
 * Embed a single text with key rotation and cooldown
 */
export async function embed(
  text: string,
  apiKeys?: (string | KeyEntry)[]
): Promise<number[]> {
  const keys = normalizeKeys(apiKeys);
  const pool = getKeyPool('embeddings', keys);
  let networkRetries = 0;

  while (true) {
    const available = pool.getAvailableKey();

    if (!available) {
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

export interface EmbeddingProgress {
  current: number;
  total: number;
}

/**
 * Embed multiple texts in batches (async generator with progress)
 */
export async function* embedBatchWithProgress(
  texts: string[],
  apiKeys?: (string | KeyEntry)[],
  signal?: { aborted: boolean }
): AsyncGenerator<EmbeddingProgress, number[], void> {
  const keys = normalizeKeys(apiKeys);
  const pool = getKeyPool('embeddings', keys);
  const embeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += config.embeddingBatchSize) {
    if (signal?.aborted) {
      throw new Error('Indexing cancelled');
    }

    const batch = texts.slice(i, i + config.embeddingBatchSize);
    console.log(
      `Embedding batch ${Math.floor(i / config.embeddingBatchSize) + 1}/${Math.ceil(texts.length / config.embeddingBatchSize)}`
    );

    const tasks = batch.map((text) => async () => {
      let networkRetries = 0;

      while (true) {
        const available = pool.getAvailableKey();

        if (!available) {
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
          if (isNetworkError(err) && networkRetries < MAX_NETWORK_RETRIES) {
            networkRetries++;
            console.log(`[Embed] Network error on "${label}", retrying (${networkRetries}/${MAX_NETWORK_RETRIES})...`);
            await sleep(1000 * networkRetries);
            continue;
          }
          const errorMsg = `Embed error on "${label}": ${(err as Error).message}`;
          logError(errorMsg);
          throw new Error(`Embedding failed after ${MAX_NETWORK_RETRIES} retries: ${(err as Error).message}`);
        }
      }
    });

    const batchResults = await runWithConcurrency(tasks, MAX_CONCURRENCY);
    embeddings.push(...batchResults);

    yield { current: Math.min(i + config.embeddingBatchSize, texts.length), total: texts.length };
  }

  return embeddings;
}

/**
 * Embed multiple texts in batches (non-streaming)
 */
export async function embedBatch(
  texts: string[],
  apiKeys?: (string | KeyEntry)[]
): Promise<number[][]> {
  const generator = embedBatchWithProgress(texts, apiKeys);
  let result: number[][] = [];

  while (true) {
    const { done, value } = await generator.next();
    if (done) {
      result = value as number[][];
      break;
    }
  }

  return result;
}
