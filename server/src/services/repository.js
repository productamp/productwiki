import simpleGit from 'simple-git';
import { join, extname, basename } from 'path';
import { readdir, readFile, stat, access } from 'fs/promises';
import { config } from '../config/index.js';

/**
 * Parse GitHub URL to extract owner and repo
 */
export function parseGitHubUrl(url) {
  // Handle various GitHub URL formats
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
 * Clone or pull a repository
 */
export async function cloneRepository(url) {
  const { owner, repo } = parseGitHubUrl(url);
  const repoPath = join(config.reposDir, owner, repo);

  const git = simpleGit();

  try {
    // Check if repo already exists
    await access(join(repoPath, '.git'));

    // Repo exists, do a pull
    console.log(`Pulling updates for ${owner}/${repo}...`);
    const repoGit = simpleGit(repoPath);
    await repoGit.pull();
  } catch {
    // Repo doesn't exist, clone it
    console.log(`Cloning ${owner}/${repo}...`);
    await git.clone(url, repoPath, ['--depth', '1']);
  }

  return { owner, repo, path: repoPath };
}

/**
 * Check if a file should be included
 */
function shouldIncludeFile(filePath, fileName) {
  const ext = extname(fileName).toLowerCase();

  // Check extension
  if (!config.supportedExtensions.includes(ext) &&
      !fileName.toLowerCase().includes('dockerfile') &&
      !fileName.toLowerCase().includes('makefile')) {
    return false;
  }

  // Check excluded files
  if (config.excludedFiles.includes(fileName)) {
    return false;
  }

  // Check excluded patterns
  for (const pattern of config.excludedPatterns) {
    if (pattern.test(filePath)) {
      return false;
    }
  }

  return true;
}

/**
 * Check if a directory should be traversed
 */
function shouldTraverseDir(dirName) {
  return !config.excludedDirs.includes(dirName);
}

/**
 * Recursively read all files in a directory
 */
async function readDirectoryRecursive(dirPath, baseDir, files = []) {
  const entries = await readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name);
    const relativePath = fullPath.replace(baseDir + '/', '');

    if (entry.isDirectory()) {
      if (shouldTraverseDir(entry.name)) {
        await readDirectoryRecursive(fullPath, baseDir, files);
      }
    } else if (entry.isFile()) {
      if (shouldIncludeFile(relativePath, entry.name)) {
        try {
          const stats = await stat(fullPath);

          // Skip files larger than max size
          if (stats.size > config.maxFileSize) {
            continue;
          }

          const content = await readFile(fullPath, 'utf-8');

          // Skip binary files (check for null bytes)
          if (content.includes('\0')) {
            continue;
          }

          files.push({
            path: relativePath,
            content,
            extension: extname(entry.name).toLowerCase(),
          });
        } catch (err) {
          console.warn(`Failed to read file ${fullPath}:`, err.message);
        }
      }
    }
  }

  return files;
}

/**
 * Read all files from a repository
 */
export async function readRepositoryFiles(repoPath) {
  return readDirectoryRecursive(repoPath, repoPath);
}

/**
 * Full repository service: clone and read files
 */
export async function processRepository(url) {
  const { owner, repo, path: repoPath } = await cloneRepository(url);
  const files = await readRepositoryFiles(repoPath);

  return {
    owner,
    repo,
    url,
    files,
  };
}
