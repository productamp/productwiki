import { homedir } from 'os';
import { join } from 'path';

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
  reposDir: join(homedir(), '.productwiki', 'repos'),
  vectorsDir: join(homedir(), '.productwiki', 'vectors'),
  metaDir: join(homedir(), '.productwiki', 'meta'),

  // Embedding settings
  embeddingBatchSize: 100,
  embeddingModel: 'text-embedding-004',
  embeddingDimensions: 768,

  // LLM settings
  llmModel: 'gemini-3-flash-preview',
  maxContextChunks: 100,

  // Server
  port: 3001,
};
