import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config/index.js';
import { logError } from '../services/errorLog.js';

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
 * Embed a single text
 */
export async function embed(text, apiKey) {
  const model = getClient(apiKey);
  const result = await model.embedContent(text);
  return result.embedding.values;
}

/**
 * Embed multiple texts in batches (async generator with progress)
 */
export async function* embedBatchWithProgress(texts, apiKey, signal) {
  const model = getClient(apiKey);
  const embeddings = [];

  // Process in batches
  for (let i = 0; i < texts.length; i += config.embeddingBatchSize) {
    // Check for cancellation
    if (signal?.aborted) {
      throw new Error('Indexing cancelled');
    }

    const batch = texts.slice(i, i + config.embeddingBatchSize);
    console.log(`Embedding batch ${Math.floor(i / config.embeddingBatchSize) + 1}/${Math.ceil(texts.length / config.embeddingBatchSize)}`);

    // Process batch in parallel
    const batchResults = await Promise.all(
      batch.map(async (text) => {
        try {
          const result = await model.embedContent(text);
          return result.embedding.values;
        } catch (err) {
          const errorMsg = `Failed to embed text: ${err.message}`;
          logError(errorMsg);
          // Return zero vector on error
          return new Array(config.embeddingDimensions).fill(0);
        }
      })
    );

    embeddings.push(...batchResults);

    // Yield progress after each batch
    yield { current: Math.min(i + config.embeddingBatchSize, texts.length), total: texts.length };
  }

  return embeddings;
}

/**
 * Embed multiple texts in batches
 */
export async function embedBatch(texts, apiKey) {
  const generator = embedBatchWithProgress(texts, apiKey);
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
