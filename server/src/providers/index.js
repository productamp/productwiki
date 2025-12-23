import { config } from '../config/index.js';
import * as geminiLlm from './llm.js';
import * as geminiEmbeddings from './embeddings.js';
import * as ollamaLlm from './ollama-llm.js';
import * as ollamaEmbeddings from './ollama-embeddings.js';

/**
 * Get the LLM provider based on configuration or request
 */
export function getLlmProvider(provider) {
  const selectedProvider = provider || config.llmProvider;

  if (selectedProvider === 'ollama') {
    return ollamaLlm;
  }
  return geminiLlm;
}

/**
 * Get the embeddings provider based on configuration or request
 */
export function getEmbeddingsProvider(provider) {
  const selectedProvider = provider || config.llmProvider;

  if (selectedProvider === 'ollama') {
    return ollamaEmbeddings;
  }
  return geminiEmbeddings;
}

/**
 * Stream chat using the configured or specified provider
 */
export async function* streamChat(systemPrompt, messages, options = {}) {
  const { provider, apiKeys, model, lowTpmMode, tpmLimit } = options;
  const llmProvider = getLlmProvider(provider);

  if (provider === 'ollama' || (!provider && config.llmProvider === 'ollama')) {
    yield* llmProvider.streamChat(systemPrompt, messages);
  } else {
    yield* llmProvider.streamChat(systemPrompt, messages, apiKeys, model, { lowTpmMode, tpmLimit });
  }
}

/**
 * Embed text using the configured or specified provider
 */
export async function embed(text, options = {}) {
  const { provider, apiKeys } = options;
  const embeddingsProvider = getEmbeddingsProvider(provider);

  if (provider === 'ollama' || (!provider && config.llmProvider === 'ollama')) {
    return embeddingsProvider.embed(text);
  }
  return embeddingsProvider.embed(text, apiKeys);
}

/**
 * Batch embed texts using the configured or specified provider
 */
export async function embedBatch(texts, options = {}) {
  const { provider, apiKeys } = options;
  const embeddingsProvider = getEmbeddingsProvider(provider);

  if (provider === 'ollama' || (!provider && config.llmProvider === 'ollama')) {
    return embeddingsProvider.embedBatch(texts);
  }
  return embeddingsProvider.embedBatch(texts, apiKeys);
}

/**
 * Batch embed texts with progress using the configured or specified provider
 * Returns an async generator that yields { current, total } progress events
 */
export async function* embedBatchWithProgress(texts, options = {}) {
  const { provider, apiKeys, signal } = options;
  const embeddingsProvider = getEmbeddingsProvider(provider);

  if (provider === 'ollama' || (!provider && config.llmProvider === 'ollama')) {
    return yield* embeddingsProvider.embedBatchWithProgress(texts, signal);
  }
  return yield* embeddingsProvider.embedBatchWithProgress(texts, apiKeys, signal);
}
