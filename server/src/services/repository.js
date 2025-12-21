/**
 * Repository service - delegates to GitHub API
 * This file maintains backwards compatibility with existing imports
 */

export {
  parseGitHubUrl,
  processRepository,
  fetchRepositoryFiles,
  fetchReadmeContent,
} from './github.js';
