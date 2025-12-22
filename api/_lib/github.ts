/**
 * GitHub API service for fetching repository contents
 * Uses the public GitHub API (no authentication required for public repos)
 */
import { config } from './config.js';

const GITHUB_API_BASE = 'https://api.github.com';

export interface GitHubFile {
  path: string;
  content: string;
  extension: string;
}

export interface RepositoryData {
  owner: string;
  repo: string;
  url: string;
  files: GitHubFile[];
  branch: string;
}

/**
 * Parse GitHub URL to extract owner and repo
 */
export function parseGitHubUrl(url: string): { owner: string; repo: string } {
  const patterns = [
    /github\.com\/([^\/]+)\/([^\/\.]+)/,
    /github\.com:([^\/]+)\/([^\/\.]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return {
        owner: match[1],
        repo: match[2].replace(/\.git$/, ''),
      };
    }
  }

  throw new Error('Invalid GitHub URL format');
}

/**
 * Fetch with GitHub API headers
 */
async function githubFetch(url: string): Promise<Response> {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'ProductWiki/1.0',
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Repository not found or is private: ${url}`);
    }
    if (response.status === 403) {
      const remaining = response.headers.get('X-RateLimit-Remaining');
      const reset = response.headers.get('X-RateLimit-Reset');
      if (remaining === '0') {
        const resetDate = new Date(parseInt(reset || '0') * 1000);
        throw new Error(`GitHub API rate limit exceeded. Resets at ${resetDate.toISOString()}`);
      }
      throw new Error(`GitHub API forbidden: ${response.statusText}`);
    }
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  return response;
}

/**
 * Get the default branch for a repository
 */
async function getDefaultBranch(owner: string, repo: string): Promise<string> {
  const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}`;
  const response = await githubFetch(url);
  const data = await response.json();
  return data.default_branch;
}

interface TreeItem {
  type: string;
  path: string;
  size?: number;
}

/**
 * Recursively fetch repository tree
 */
async function getRepositoryTree(owner: string, repo: string, branch: string): Promise<TreeItem[]> {
  const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;
  const response = await githubFetch(url);
  const data = await response.json();

  if (data.truncated) {
    console.warn(`[GitHub] Tree response was truncated for ${owner}/${repo}. Some files may be missing.`);
  }

  return data.tree || [];
}

/**
 * Fetch raw file content from GitHub
 */
async function fetchFileContent(owner: string, repo: string, path: string, branch: string): Promise<string> {
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'ProductWiki/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${path}: ${response.status}`);
  }

  return response.text();
}

/**
 * Check if file extension is supported
 */
function isSupportedExtension(path: string, supportedExtensions: string[]): boolean {
  const ext = path.includes('.') ? '.' + path.split('.').pop()?.toLowerCase() : '';

  // Special cases for files without typical extensions
  const baseName = path.split('/').pop()?.toLowerCase() || '';
  if (baseName.includes('dockerfile') || baseName.includes('makefile')) {
    return true;
  }

  return supportedExtensions.includes(ext);
}

/**
 * Check if path should be excluded
 */
function shouldExcludePath(
  path: string,
  excludedDirs: string[],
  excludedFiles: string[],
  excludedPatterns: RegExp[]
): boolean {
  const parts = path.split('/');
  const fileName = parts[parts.length - 1];

  // Check excluded directories
  for (const dir of excludedDirs) {
    if (parts.includes(dir)) {
      return true;
    }
  }

  // Check excluded files
  if (excludedFiles.includes(fileName)) {
    return true;
  }

  // Check excluded patterns
  for (const pattern of excludedPatterns) {
    if (pattern.test(path)) {
      return true;
    }
  }

  return false;
}

/**
 * Fetch all files from a public GitHub repository using the API
 */
export async function fetchRepositoryFiles(
  owner: string,
  repo: string
): Promise<{ files: GitHubFile[]; branch: string }> {
  console.log(`[GitHub] Fetching repository ${owner}/${repo}...`);

  // Get the default branch
  const branch = await getDefaultBranch(owner, repo);
  console.log(`[GitHub] Default branch: ${branch}`);

  // Get the full tree
  const tree = await getRepositoryTree(owner, repo, branch);
  console.log(`[GitHub] Found ${tree.length} items in tree`);

  // Filter to supported files
  const files = tree.filter((item) => {
    if (item.type !== 'blob') return false;
    if (item.size && item.size > config.maxFileSize) return false;
    if (!isSupportedExtension(item.path, config.supportedExtensions)) return false;
    if (shouldExcludePath(item.path, config.excludedDirs, config.excludedFiles, config.excludedPatterns)) {
      return false;
    }
    return true;
  });

  console.log(`[GitHub] ${files.length} files match filter criteria`);

  // Fetch content for each file (with concurrency limit)
  const CONCURRENCY = 10;
  const results: GitHubFile[] = [];
  let completed = 0;

  for (let i = 0; i < files.length; i += CONCURRENCY) {
    const batch = files.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(async (file) => {
        try {
          const content = await fetchFileContent(owner, repo, file.path, branch);

          // Skip binary files (check for null bytes)
          if (content.includes('\0')) {
            return null;
          }

          return {
            path: file.path,
            content,
            extension: file.path.includes('.') ? '.' + file.path.split('.').pop()?.toLowerCase() : '',
          };
        } catch (error) {
          console.warn(`[GitHub] Failed to fetch ${file.path}: ${(error as Error).message}`);
          return null;
        }
      })
    );

    results.push(...(batchResults.filter(Boolean) as GitHubFile[]));
    completed += batch.length;

    if (completed % 50 === 0 || completed === files.length) {
      console.log(`[GitHub] Fetched ${completed}/${files.length} files`);
    }
  }

  console.log(`[GitHub] Successfully fetched ${results.length} files`);
  return { files: results, branch };
}

/**
 * Fetch README content from repository
 */
export async function fetchReadmeContent(owner: string, repo: string, branch: string): Promise<string> {
  const readmeNames = ['README.md', 'readme.md', 'README.MD', 'README', 'readme.txt', 'README.txt'];

  for (const name of readmeNames) {
    try {
      const content = await fetchFileContent(owner, repo, name, branch);
      return content;
    } catch {
      // Try next name
    }
  }

  return 'No README found.';
}

/**
 * Process a repository: fetch all files via GitHub API
 */
export async function processRepository(url: string): Promise<RepositoryData> {
  const { owner, repo } = parseGitHubUrl(url);
  const { files, branch } = await fetchRepositoryFiles(owner, repo);

  return {
    owner,
    repo,
    url,
    files,
    branch,
  };
}
