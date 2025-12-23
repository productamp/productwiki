/**
 * Provider presets - bundles of embedding + generation provider configurations
 */

export const PRESETS = {
  'gemini-cloud': {
    id: 'gemini-cloud',
    name: 'Gemini Cloud',
    description: 'Google Gemini Flash - fast and capable',
    embedding: {
      provider: 'gemini',
      model: 'text-embedding-004',
      dimensions: 768,
    },
    generation: {
      provider: 'gemini',
      model: 'gemini-2.0-flash',
    },
    requiresApiKey: 'google',
  },

  'gemma-cloud': {
    id: 'gemma-cloud',
    name: 'Gemma Cloud',
    description: 'Google Gemma 3 27B - open model on Google infrastructure',
    embedding: {
      provider: 'gemini',
      model: 'text-embedding-004',
      dimensions: 768,
    },
    generation: {
      provider: 'gemini',
      model: 'gemma-3-27b-it',
    },
    requiresApiKey: 'google',
  },

  'best-free-cloud': {
    id: 'best-free-cloud',
    name: 'Best Free Cloud',
    description: 'Groq + Jina - no API key required',
    embedding: {
      provider: 'jina',
      model: 'jina-code-embeddings-0.5b',
      dimensions: 896,
    },
    generation: {
      provider: 'groq',
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    },
    requiresApiKey: null, // Server provides fallback keys
  },

  'local-llm': {
    id: 'local-llm',
    name: 'Local LLM',
    description: 'Ollama - runs entirely on your machine',
    embedding: {
      provider: 'ollama',
      model: 'nomic-embed-text',
      dimensions: 768,
    },
    generation: {
      provider: 'ollama',
      model: 'qwen2.5-coder:3b',
    },
    requiresApiKey: null,
  },
};

/**
 * Default preset when none is specified
 */
export const DEFAULT_PRESET = 'best-free-cloud';

/**
 * Get preset configuration by ID
 * @param {string} presetId - Preset identifier
 * @returns {Object|null} Preset configuration or null if not found
 */
export function getPreset(presetId) {
  return PRESETS[presetId] || null;
}

/**
 * Get all preset IDs
 * @returns {string[]}
 */
export function getPresetIds() {
  return Object.keys(PRESETS);
}

/**
 * Check if a preset ID is valid
 * @param {string} presetId
 * @returns {boolean}
 */
export function isValidPreset(presetId) {
  return presetId in PRESETS;
}
