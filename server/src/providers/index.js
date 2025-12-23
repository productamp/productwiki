import { config } from '../config/index.js';
import { getPreset, DEFAULT_PRESET } from '../config/presets.js';
import * as geminiLlm from './llm.js';
import * as geminiEmbeddings from './embeddings.js';
import * as ollamaLlm from './ollama-llm.js';
import * as ollamaEmbeddings from './ollama-embeddings.js';
import * as groqLlm from './groq-llm.js';
import * as jinaEmbeddings from './jina-embeddings.js';

/**
 * Get the LLM provider module based on provider name
 */
export function getLlmProvider(provider) {
  if (provider === 'ollama') {
    return ollamaLlm;
  }
  if (provider === 'groq') {
    return groqLlm;
  }
  return geminiLlm;
}

/**
 * Get the embeddings provider module based on provider name
 */
export function getEmbeddingsProvider(provider) {
  if (provider === 'ollama') {
    return ollamaEmbeddings;
  }
  if (provider === 'jina') {
    return jinaEmbeddings;
  }
  return geminiEmbeddings;
}

/**
 * Resolve preset configuration from options
 * @param {Object} options - Options containing preset, apiKeys, etc.
 * @returns {Object} Resolved preset config with provider info
 */
export function resolvePreset(options = {}) {
  const presetId = options.preset || DEFAULT_PRESET;
  const preset = getPreset(presetId);

  if (!preset) {
    console.warn(`[Providers] Unknown preset "${presetId}", falling back to ${DEFAULT_PRESET}`);
    return getPreset(DEFAULT_PRESET);
  }

  return preset;
}

/**
 * Stream chat using the preset's generation provider
 */
export async function* streamChat(systemPrompt, messages, options = {}) {
  const { apiKeys, lowTpmMode, tpmLimit, groqApiKeys } = options;
  const preset = resolvePreset(options);
  const generationProvider = preset.generation.provider;
  const model = preset.generation.model;

  console.log(`[Providers] streamChat using preset "${preset.id}" (${generationProvider}/${model})`);

  const llmProvider = getLlmProvider(generationProvider);

  if (generationProvider === 'ollama') {
    yield* llmProvider.streamChat(systemPrompt, messages);
  } else if (generationProvider === 'groq') {
    yield* llmProvider.streamChat(systemPrompt, messages, groqApiKeys);
  } else {
    // Gemini
    yield* llmProvider.streamChat(systemPrompt, messages, apiKeys, model, { lowTpmMode, tpmLimit });
  }
}

/**
 * Embed text using the preset's embedding provider
 */
export async function embed(text, options = {}) {
  const { apiKeys, jinaApiKey } = options;
  const preset = resolvePreset(options);
  const embeddingProvider = preset.embedding.provider;

  const embeddingsModule = getEmbeddingsProvider(embeddingProvider);

  if (embeddingProvider === 'ollama') {
    return embeddingsModule.embed(text);
  }
  if (embeddingProvider === 'jina') {
    return embeddingsModule.embed(text, jinaApiKey);
  }
  // Gemini
  return embeddingsModule.embed(text, apiKeys);
}

/**
 * Batch embed texts using the preset's embedding provider
 */
export async function embedBatch(texts, options = {}) {
  const { apiKeys, jinaApiKey } = options;
  const preset = resolvePreset(options);
  const embeddingProvider = preset.embedding.provider;

  const embeddingsModule = getEmbeddingsProvider(embeddingProvider);

  if (embeddingProvider === 'ollama') {
    return embeddingsModule.embedBatch(texts);
  }
  if (embeddingProvider === 'jina') {
    return embeddingsModule.embedBatch(texts, jinaApiKey);
  }
  // Gemini
  return embeddingsModule.embedBatch(texts, apiKeys);
}

/**
 * Batch embed texts with progress using the preset's embedding provider
 * Returns an async generator that yields { current, total } progress events
 */
export async function* embedBatchWithProgress(texts, options = {}) {
  const { apiKeys, jinaApiKey, signal } = options;
  const preset = resolvePreset(options);
  const embeddingProvider = preset.embedding.provider;

  console.log(`[Providers] embedBatchWithProgress using preset "${preset.id}" (${embeddingProvider})`);

  const embeddingsModule = getEmbeddingsProvider(embeddingProvider);

  if (embeddingProvider === 'ollama') {
    return yield* embeddingsModule.embedBatchWithProgress(texts, signal);
  }
  if (embeddingProvider === 'jina') {
    return yield* embeddingsModule.embedBatchWithProgress(texts, jinaApiKey, signal);
  }
  // Gemini
  return yield* embeddingsModule.embedBatchWithProgress(texts, apiKeys, signal);
}

/**
 * Get embedding dimensions for the preset
 */
export function getEmbeddingDimensions(options = {}) {
  const preset = resolvePreset(options);
  return preset.embedding.dimensions;
}

// Re-export presets for external use
export { getPreset, DEFAULT_PRESET, PRESETS } from '../config/presets.js';
