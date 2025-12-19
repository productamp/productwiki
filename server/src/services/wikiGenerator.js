import { join } from 'path';
import { readFile } from 'fs/promises';
import { config } from '../config/index.js';
import { streamChat } from '../providers/index.js';
import { readRepositoryFiles } from './repository.js';
import {
  getStructureGenerationPrompt,
  getPageGenerationPrompt,
  briefWikiTemplate,
  detailedWikiTemplate,
} from '../templates/wikiStructure.js';

/**
 * Get the file tree of a repository as a string
 */
async function getFileTree(repoPath) {
  const files = await readRepositoryFiles(repoPath);
  const paths = files.map(f => f.path).sort();
  return paths.join('\n');
}

/**
 * Get the README content from a repository
 */
async function getReadmeContent(repoPath) {
  const readmeNames = ['README.md', 'readme.md', 'README.MD', 'README', 'readme.txt', 'README.txt'];

  for (const name of readmeNames) {
    try {
      const content = await readFile(join(repoPath, name), 'utf-8');
      return content;
    } catch {
      // Try next name
    }
  }

  return 'No README found.';
}

/**
 * Read specific files from repository and combine their content
 */
async function readFilesContent(repoPath, filePaths) {
  const contents = [];

  for (const filePath of filePaths) {
    try {
      const fullPath = join(repoPath, filePath);
      const content = await readFile(fullPath, 'utf-8');
      contents.push({
        path: filePath,
        content,
      });
    } catch (err) {
      console.warn(`Could not read file ${filePath}:`, err.message);
    }
  }

  return contents;
}

/**
 * Build context string from file contents
 */
function buildFileContext(files) {
  return files
    .map((file, index) => {
      const ext = file.path.split('.').pop() || '';
      return `${index + 1}.\nFile Path: ${file.path}\nContent:\n\`\`\`${ext}\n${file.content}\n\`\`\``;
    })
    .join('\n\n');
}

/**
 * Generate wiki structure using LLM
 * Phase 1: Analyze file tree + README to determine optimal wiki structure
 */
async function generateWikiStructure(owner, repo, repoPath, isComprehensive, options = {}) {
  const fileTree = await getFileTree(repoPath);
  const readme = await getReadmeContent(repoPath);

  const prompt = getStructureGenerationPrompt(owner, repo, fileTree, readme, isComprehensive);

  const messages = [
    {
      role: 'user',
      content: prompt,
    },
  ];

  let structureJson = '';
  for await (const chunk of streamChat('You are a technical documentation expert.', messages, options)) {
    structureJson += chunk;
  }

  // Clean up potential markdown code blocks
  structureJson = structureJson.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  // Try to parse
  try {
    const structure = JSON.parse(structureJson);

    // Validate required fields
    if (!structure.title || !structure.pages || !Array.isArray(structure.pages)) {
      throw new Error('Invalid structure format');
    }

    // Ensure each page has required fields
    for (const page of structure.pages) {
      page.id = page.id || `page-${structure.pages.indexOf(page) + 1}`;
      page.title = page.title || 'Untitled';
      page.filePaths = page.filePaths || [];
      page.relatedPages = page.relatedPages || [];
      page.importance = page.importance || 'medium';
    }

    return structure;
  } catch (e) {
    console.error('Failed to parse wiki structure:', e.message);
    console.error('Raw response:', structureJson.slice(0, 500));
    throw new Error(`Failed to parse wiki structure: ${e.message}`);
  }
}

/**
 * Get wiki structure (LLM-generated or template fallback)
 */
async function getWikiStructure(owner, repo, repoPath, type, options = {}) {
  const isComprehensive = type === 'detailed';

  try {
    // Try LLM-generated structure
    const structure = await generateWikiStructure(owner, repo, repoPath, isComprehensive, options);
    return structure;
  } catch (error) {
    console.warn('LLM structure generation failed, using template fallback:', error.message);

    // Fallback to template
    const template = isComprehensive
      ? JSON.parse(JSON.stringify(detailedWikiTemplate))
      : JSON.parse(JSON.stringify(briefWikiTemplate));

    template.title = `${owner}/${repo}`;
    template.description = `Documentation for ${owner}/${repo}`;

    // Populate file paths from repository
    const files = await readRepositoryFiles(repoPath);
    const allPaths = files.map(f => f.path);

    // Simple heuristic to assign files to pages
    for (const page of template.pages) {
      if (page.id === 'overview' || page.id === 'getting-started') {
        page.filePaths = allPaths.filter(p =>
          p.toLowerCase().includes('readme') ||
          p.includes('package.json') ||
          p.includes('index.')
        ).slice(0, 5);
      } else if (page.id === 'architecture') {
        page.filePaths = allPaths.filter(p =>
          p.includes('src/') ||
          p.includes('lib/') ||
          p.includes('app/')
        ).slice(0, 8);
      } else if (page.id === 'api-reference') {
        page.filePaths = allPaths.filter(p =>
          p.includes('routes') ||
          p.includes('api') ||
          p.includes('controller')
        ).slice(0, 8);
      } else if (page.id === 'configuration') {
        page.filePaths = allPaths.filter(p =>
          p.includes('config') ||
          p.includes('.env') ||
          p.includes('settings')
        ).slice(0, 5);
      } else {
        // Default: assign some files
        page.filePaths = allPaths.slice(0, 5);
      }
    }

    return template;
  }
}

/**
 * Generate content for a single wiki page
 * Phase 2: Read relevant files and generate comprehensive documentation
 */
async function* generatePageContent(repoPath, page, repoUrl, options = {}) {
  // Read the relevant files
  const files = await readFilesContent(repoPath, page.filePaths);

  if (files.length === 0) {
    yield {
      type: 'content',
      chunk: `*No relevant files found for this page. Files searched: ${page.filePaths.join(', ')}*`,
    };
    return { sources: [] };
  }

  // Build context from files
  const context = buildFileContext(files);

  // Generate page prompt
  const userPrompt = `${getPageGenerationPrompt(page.title, page.filePaths, repoUrl)}

Here is the content of the relevant source files:

${context}

Generate the wiki page content now.`;

  const messages = [
    {
      role: 'user',
      content: userPrompt,
    },
  ];

  // Stream the response
  for await (const chunk of streamChat('', messages, options)) {
    yield { type: 'content', chunk };
  }

  // Return sources (the files we used)
  const sources = files.map(f => ({
    path: f.path,
    relevance: 1.0, // All files are explicitly requested, so relevance is 1.0
  }));

  return { sources };
}

/**
 * Generate wiki documentation with streaming events
 *
 * Yields events in this order:
 * 1. { type: 'status', message: '...' }
 * 2. { type: 'structure', wiki: {...} }
 * 3. For each page:
 *    - { type: 'page_start', pageId, title }
 *    - { type: 'content', chunk: '...' } (multiple)
 *    - { type: 'page_complete', pageId, sources: [...] }
 * 4. { type: 'complete' }
 */
export async function* generateWiki(owner, repo, type = 'detailed', options = {}) {
  const repoPath = join(config.reposDir, owner, repo);
  const repoUrl = `https://github.com/${owner}/${repo}`;

  // Phase 1: Get/Generate structure
  yield { type: 'status', message: 'Analyzing codebase structure...' };

  let structure;
  try {
    structure = await getWikiStructure(owner, repo, repoPath, type, options);
  } catch (error) {
    yield { type: 'error', message: error.message };
    return;
  }

  // Send structure to frontend
  yield { type: 'structure', wiki: structure };

  yield { type: 'status', message: 'Generating documentation...' };

  // Phase 2: Generate content for each page
  for (const page of structure.pages) {
    // Signal page start
    yield {
      type: 'page_start',
      pageId: page.id,
      title: page.title,
    };

    yield { type: 'status', message: `Generating: ${page.title}...` };

    // Generate page content
    let sources = [];
    try {
      const generator = generatePageContent(repoPath, page, repoUrl, options);
      let result = await generator.next();

      while (!result.done) {
        yield result.value;
        result = await generator.next();
      }

      // Get sources from return value
      if (result.value && result.value.sources) {
        sources = result.value.sources;
      }
    } catch (error) {
      yield { type: 'content', chunk: `*Error generating page: ${error.message}*` };
    }

    // Signal page complete
    yield {
      type: 'page_complete',
      pageId: page.id,
      sources,
    };
  }

  // Signal complete
  yield { type: 'complete' };
}

/**
 * Generate brief wiki (convenience wrapper)
 */
export async function* generateBriefWiki(owner, repo, options = {}) {
  yield* generateWiki(owner, repo, 'brief', options);
}

/**
 * Generate detailed wiki (convenience wrapper)
 */
export async function* generateDetailedWiki(owner, repo, options = {}) {
  yield* generateWiki(owner, repo, 'detailed', options);
}
