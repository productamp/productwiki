import { config } from '../config/index.js';
import { logError } from '../services/errorLog.js';

/**
 * Get Ollama host URL from environment or config
 */
function getOllamaHost() {
  // OLLAMA_HOST is the standard env var used by Ollama
  let host = process.env.OLLAMA_HOST || config.ollamaHost || 'http://localhost:11434';
  // Remove /api suffix if present
  if (host.endsWith('/api')) {
    host = host.slice(0, -4);
  }
  return host;
}

/**
 * Embed a single text using Ollama
 */
export async function embed(text) {
  const host = getOllamaHost();
  const model = config.ollamaEmbeddingModel || 'nomic-embed-text';

  const response = await fetch(`${host}/api/embed`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input: text,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Ollama embedding error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  return result.embeddings[0];
}

/**
 * Embed multiple texts one at a time using Ollama (async generator with progress)
 * Note: Ollama doesn't reliably support batch embedding, so we process individually
 */
export async function* embedBatchWithProgress(texts, signal) {
  const host = getOllamaHost();
  const model = config.ollamaEmbeddingModel || 'nomic-embed-text';
  const embeddings = [];
  let expectedDimensions = null;

  console.log(`Embedding ${texts.length} texts with Ollama (one at a time)...`);

  for (let i = 0; i < texts.length; i++) {
    // Check for cancellation
    if (signal?.aborted) {
      throw new Error('Indexing cancelled');
    }

    const text = texts[i];

    // Yield progress every item
    yield { current: i + 1, total: texts.length };

    try {
      const response = await fetch(`${host}/api/embed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          input: text,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama embedding error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      const embedding = result.embeddings[0];

      // Validate embedding dimension consistency
      if (expectedDimensions === null) {
        expectedDimensions = embedding.length;
        console.log(`Detected embedding dimensions: ${expectedDimensions}`);
      } else if (embedding.length !== expectedDimensions) {
        logError(`Embedding dimension mismatch: expected ${expectedDimensions}, got ${embedding.length}`);
        // Use zero vector for inconsistent embeddings
        embeddings.push(new Array(expectedDimensions).fill(0));
        continue;
      }

      embeddings.push(embedding);
    } catch (err) {
      if (err.message === 'Indexing cancelled') {
        throw err;
      }
      logError(`Failed to embed text ${i + 1}: ${err.message}`);
      // Return zero vector on error
      const zeroDimensions = expectedDimensions || config.ollamaEmbeddingDimensions || 768;
      embeddings.push(new Array(zeroDimensions).fill(0));
    }
  }

  console.log(`Embedding complete: ${embeddings.length} embeddings created`);
  return embeddings;
}

/**
 * Embed multiple texts one at a time using Ollama
 * Note: Ollama doesn't reliably support batch embedding, so we process individually
 */
export async function embedBatch(texts) {
  const generator = embedBatchWithProgress(texts);
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
