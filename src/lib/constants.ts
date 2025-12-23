// File filtering constants - mirrored from server/src/config/index.js
// Keep in sync with server config

export const SUPPORTED_EXTENSIONS = [
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
];

export const EXCLUDED_DIRS = [
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
];

export const EXCLUDED_FILES = [
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'bun.lockb',
  'composer.lock',
  'Gemfile.lock',
  'Cargo.lock',
  'poetry.lock',
  'go.sum',
];

export const EXCLUDED_PATTERNS = [
  /\.min\.js$/,
  /\.min\.css$/,
  /\.map$/,
  /\.d\.ts$/,
  /\.bundle\.js$/,
  /\.chunk\.js$/,
];

export const MAX_FILE_SIZE = 1024 * 1024; // 1MB
export const MAX_FILE_COUNT = 5000;
export const WARNING_FILE_COUNT = 1000;
