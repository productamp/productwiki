import { homedir } from 'os';
import { join } from 'path';

/**
 * Parse API keys from environment variable
 * Supports: JSON array of {key, label} or comma-separated "label:key" pairs
 */
function parseApiKeys(envValue) {
  if (!envValue) return null;

  // Try JSON first
  try {
    const parsed = JSON.parse(envValue);
    if (Array.isArray(parsed)) {
      return parsed.map((item, i) => {
        if (typeof item === 'string') {
          return { key: item, label: `Key ${i + 1}` };
        }
        return { key: item.key, label: item.label || `Key ${i + 1}` };
      });
    }
  } catch {
    // Not JSON, try comma-separated format: "label:key,label:key"
  }

  // Parse comma-separated format: "label:key,label:key" or just "key,key"
  return envValue.split(',').map((part, i) => {
    const trimmed = part.trim();
    const colonIndex = trimmed.indexOf(':');
    if (colonIndex > 0 && colonIndex < trimmed.length - 1) {
      return {
        label: trimmed.substring(0, colonIndex),
        key: trimmed.substring(colonIndex + 1),
      };
    }
    return { key: trimmed, label: `Key ${i + 1}` };
  }).filter(entry => entry.key);
}

export const config = {
  // Chunking settings
  chunkSize: 350,
  chunkOverlap: 100,

  // Supported file extensions
  supportedExtensions: [
    '.js', '.ts', '.tsx', '.jsx', '.mjs', '.cjs',
    '.py', '.pyw',
    '.java', '.kt', '.scala',
    '.go',
    '.rs',
    '.rb', '.erb',
    '.php',
    '.c', '.cpp', '.cc', '.h', '.hpp',
    '.cs',
    '.swift',
    '.md', '.mdx', '.rst', '.txt',
    '.json', '.yaml', '.yml', '.toml', '.ini', '.env.example',
    '.html', '.htm', '.css', '.scss', '.sass', '.less',
    '.vue', '.svelte', '.astro',
    '.sql',
    '.sh', '.bash', '.zsh',
    '.dockerfile', '.docker-compose.yml',
    '.graphql', '.gql',
    '.proto',
  ],

  // Excluded directories
  excludedDirs: [
    'node_modules',
    '.git',
    'dist',
    'build',
    '.next',
    '__pycache__',
    'vendor',
    'coverage',
    '.nyc_output',
    '.cache',
    '.turbo',
    '.vercel',
    '.netlify',
    'target',
    'out',
    '.output',
    '.nuxt',
    '.svelte-kit',
    'venv',
    '.venv',
    'env',
    '.env',
    '.idea',
    '.vscode',
  ],

  // Excluded files
  excludedFiles: [
    'package-lock.json',
    'yarn.lock',
    'pnpm-lock.yaml',
    'bun.lockb',
    'composer.lock',
    'Gemfile.lock',
    'Cargo.lock',
    'poetry.lock',
    'go.sum',
  ],

  // Excluded patterns
  excludedPatterns: [
    /\.min\.js$/,
    /\.min\.css$/,
    /\.map$/,
    /\.d\.ts$/,
    /\.bundle\.js$/,
    /\.chunk\.js$/,
  ],

  // Max file size (1MB)
  maxFileSize: 1024 * 1024,

  // Data directory
  dataDir: join(homedir(), '.productwiki'),
  vectorsDir: join(homedir(), '.productwiki', 'vectors'),
  metaDir: join(homedir(), '.productwiki', 'meta'),

  // Embedding settings
  embeddingBatchSize: 100,
  embeddingConcurrency: 5, // Max parallel embedding requests to avoid connection issues
  embeddingModel: 'text-embedding-004',
  embeddingDimensions: 768,

  // LLM settings
  llmModel: 'gemma-3-27b-it',
  maxContextChunks: 100,

  // RAG settings for wiki generation
  topK: 20, // Number of chunks to retrieve per section query

  // Provider selection: 'gemini' or 'ollama'
  llmProvider: process.env.LLM_PROVIDER || 'gemini',

  // Server-side API keys (used as fallback when user doesn't provide keys)
  // Format: JSON array of {key, label} objects or comma-separated keys
  googleApiKeys: parseApiKeys(process.env.GOOGLE_API_KEYS) ||
    (process.env.GOOGLE_API_KEY ? [{ key: process.env.GOOGLE_API_KEY, label: 'Default' }] : []),

  // Ollama settings (OLLAMA_HOST is the standard env var used by Ollama CLI)
  ollamaHost: process.env.OLLAMA_HOST || 'http://localhost:11434',
  ollamaLlmModel: process.env.OLLAMA_LLM_MODEL || 'qwen2.5-coder:3b',
  ollamaEmbeddingModel: process.env.OLLAMA_EMBEDDING_MODEL || 'nomic-embed-text',
  ollamaEmbeddingDimensions: 768, // nomic-embed-text default, auto-detected at runtime

  // Groq settings (fallback keys for 'best-free-cloud' preset)
  groqApiKeys: parseApiKeys(process.env.GROQ_API_KEYS) ||
    (process.env.GROQ_API_KEY ? [{ key: process.env.GROQ_API_KEY, label: 'Default' }] : []),

  // Jina AI settings (fallback key for 'best-free-cloud' preset)
  jinaApiKey: process.env.JINA_API_KEY || null,

  // Server
  port: 3847,
};
