import { config } from '../config/index.js';
import { streamChat } from '../providers/index.js';
import { fetchRepositoryFiles, fetchReadmeContent } from './repository.js';
import { queryRag, buildRagContext, isIndexed, getProjectMetadata } from './ragQuery.js';
import { logError } from './errorLog.js';
import {
  getStructureGenerationPrompt,
  getPageGenerationPrompt,
  briefWikiTemplate,
  detailedWikiTemplate,
  productDocsTemplate,
  getProductDocsStructurePrompt,
  getProductDocsPagePrompt,
} from '../templates/wikiStructure.js';

/**
 * Get the file tree of a repository as a string using GitHub API
 */
async function getFileTree(owner, repo, branch) {
  const { files } = await fetchRepositoryFiles(owner, repo, config);
  const paths = files.map(f => f.path).sort();
  return { fileTree: paths.join('\n'), files };
}

/**
 * Get the README content from a repository using GitHub API
 */
async function getReadmeContent(owner, repo, branch) {
  return fetchReadmeContent(owner, repo, branch);
}

/**
 * Standard mode limits
 */
const STANDARD_LIMITS = {
  MAX_FILE_TREE_CHARS: 10000,
  WIKI_CHUNK_LIMIT: 15,
  STRUCTURE_CHUNK_LIMIT: 10,
};

/**
 * Conservative mode limits (for low TPM)
 */
const CONSERVATIVE_LIMITS = {
  MAX_FILE_TREE_CHARS: 5000,
  WIKI_CHUNK_LIMIT: 8,
  STRUCTURE_CHUNK_LIMIT: 5,
};

/**
 * Get limits based on TPM mode
 */
function getLimits(options) {
  return options.lowTpmMode ? CONSERVATIVE_LIMITS : STANDARD_LIMITS;
}

/**
 * Get relevant chunks for a page using RAG vector search
 */
async function getRelevantChunks(owner, repo, page, options = {}) {
  const limits = getLimits(options);
  // Build search query from page title and description
  const searchQuery = `${page.title}. ${page.description || ''}`;
  return queryRag(owner, repo, searchQuery, options, limits.WIKI_CHUNK_LIMIT);
}

/**
 * Generate wiki structure using LLM
 * Phase 1: Analyze file tree + RAG context to determine optimal wiki structure
 */
async function generateWikiStructure(owner, repo, branch, isComprehensive, options = {}) {
  const limits = getLimits(options);
  const { fileTree: rawFileTree, files } = await getFileTree(owner, repo, branch);
  let fileTree = rawFileTree;

  // Truncate file tree if too long
  if (fileTree.length > limits.MAX_FILE_TREE_CHARS) {
    fileTree = fileTree.slice(0, limits.MAX_FILE_TREE_CHARS) + '\n... [truncated]';
    console.log(`[Wiki] File tree truncated to ${limits.MAX_FILE_TREE_CHARS} chars (mode: ${options.lowTpmMode ? 'conservative' : 'standard'})`);
  }

  // Use RAG to get project overview instead of raw README
  const overviewQuery = 'project overview purpose features architecture getting started README';
  const overviewChunks = await queryRag(owner, repo, overviewQuery, options, limits.STRUCTURE_CHUNK_LIMIT);
  const overviewContext = buildRagContext(overviewChunks, options);
  console.log(`[Wiki] Structure using RAG context: ${overviewChunks.length} chunks, ${overviewContext.length} chars`);

  const prompt = getStructureGenerationPrompt(owner, repo, fileTree, overviewContext, isComprehensive);
  console.log(`[Wiki] Structure prompt size: ${prompt.length} chars (~${Math.ceil(prompt.length / 4)} tokens)`);

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
 * Generate product documentation structure using LLM
 * Phase 1: Analyze file tree + RAG context to determine user-focused documentation structure
 */
async function generateProductDocsStructure(owner, repo, branch, options = {}) {
  const limits = getLimits(options);
  const { fileTree: rawFileTree, files } = await getFileTree(owner, repo, branch);
  let fileTree = rawFileTree;

  // Truncate file tree if too long
  if (fileTree.length > limits.MAX_FILE_TREE_CHARS) {
    fileTree = fileTree.slice(0, limits.MAX_FILE_TREE_CHARS) + '\n... [truncated]';
    console.log(`[ProductDocs] File tree truncated to ${limits.MAX_FILE_TREE_CHARS} chars (mode: ${options.lowTpmMode ? 'conservative' : 'standard'})`);
  }

  // Use RAG to get project overview instead of raw README
  const overviewQuery = 'product features user guide getting started usage documentation README';
  const overviewChunks = await queryRag(owner, repo, overviewQuery, options, limits.STRUCTURE_CHUNK_LIMIT);
  const overviewContext = buildRagContext(overviewChunks, options);
  console.log(`[ProductDocs] Structure using RAG context: ${overviewChunks.length} chunks, ${overviewContext.length} chars`);

  const prompt = getProductDocsStructurePrompt(owner, repo, fileTree, overviewContext);
  console.log(`[ProductDocs] Structure prompt size: ${prompt.length} chars (~${Math.ceil(prompt.length / 4)} tokens)`);

  const messages = [
    {
      role: 'user',
      content: prompt,
    },
  ];

  let structureJson = '';
  for await (const chunk of streamChat('You are a product documentation expert focused on end-user experience.', messages, options)) {
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
    console.error('Failed to parse product docs structure:', e.message);
    console.error('Raw response:', structureJson.slice(0, 500));
    throw new Error(`Failed to parse product docs structure: ${e.message}`);
  }
}

/**
 * Get wiki structure (LLM-generated or template fallback)
 */
async function getWikiStructure(owner, repo, branch, type, options = {}) {
  const isComprehensive = type === 'detailed';

  try {
    // Try LLM-generated structure
    const structure = await generateWikiStructure(owner, repo, branch, isComprehensive, options);
    return structure;
  } catch (error) {
    console.warn('LLM structure generation failed, using template fallback:', error.message);

    // Fallback to template
    const template = isComprehensive
      ? JSON.parse(JSON.stringify(detailedWikiTemplate))
      : JSON.parse(JSON.stringify(briefWikiTemplate));

    template.title = `${owner}/${repo}`;
    template.description = `Documentation for ${owner}/${repo}`;

    // Populate file paths from repository via GitHub API
    const { files } = await fetchRepositoryFiles(owner, repo, config);
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
 * Get product documentation structure (LLM-generated or template fallback)
 */
async function getProductDocsStructure(owner, repo, branch, options = {}) {
  try {
    // Try LLM-generated structure
    const structure = await generateProductDocsStructure(owner, repo, branch, options);
    return structure;
  } catch (error) {
    console.warn('LLM product docs structure generation failed, using template fallback:', error.message);

    // Fallback to template
    const template = JSON.parse(JSON.stringify(productDocsTemplate));

    template.title = `${owner}/${repo} - User Guide`;
    template.description = `User documentation for ${owner}/${repo}`;

    // Populate file paths from repository via GitHub API - focus on user-facing files
    const { files } = await fetchRepositoryFiles(owner, repo, config);
    const allPaths = files.map(f => f.path);

    // Heuristic to assign files to pages based on feature areas
    for (const page of template.pages) {
      if (page.id === 'overview') {
        page.filePaths = allPaths.filter(p =>
          p.toLowerCase().includes('readme') ||
          p.includes('package.json') ||
          p.includes('index.')
        ).slice(0, 5);
      } else if (page.id === 'quick-start') {
        page.filePaths = allPaths.filter(p =>
          p.toLowerCase().includes('readme') ||
          p.includes('config') ||
          p.includes('setup') ||
          p.includes('index.')
        ).slice(0, 5);
      } else if (page.id === 'features') {
        // Look for main feature implementations
        page.filePaths = allPaths.filter(p =>
          p.includes('components/') ||
          p.includes('pages/') ||
          p.includes('features/') ||
          p.includes('views/') ||
          p.includes('services/')
        ).slice(0, 8);
      } else if (page.id === 'settings') {
        // Look for config, settings
        page.filePaths = allPaths.filter(p =>
          p.includes('config') ||
          p.includes('settings') ||
          p.includes('preferences') ||
          p.includes('options')
        ).slice(0, 6);
      } else if (page.id === 'faq' || page.id === 'troubleshooting') {
        // Look for error handling, common patterns
        page.filePaths = allPaths.filter(p =>
          p.includes('error') ||
          p.includes('utils') ||
          p.toLowerCase().includes('readme') ||
          p.includes('constants')
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
 * Phase 2: Use RAG to find relevant code chunks and generate documentation
 */
async function* generatePageContent(owner, repo, page, repoUrl, options = {}) {
  // Use RAG to find relevant chunks
  const chunks = await getRelevantChunks(owner, repo, page, options);

  if (chunks.length === 0) {
    yield {
      type: 'content',
      chunk: `*No relevant content found for this page. Topic: ${page.title}*`,
    };
    return { sources: [] };
  }

  // Build context from RAG chunks
  const context = buildRagContext(chunks);

  // Get unique file paths from chunks for the prompt
  const filePaths = [...new Set(chunks.map(c => c.path))];

  // Generate page prompt
  const userPrompt = `${getPageGenerationPrompt(page.title, filePaths, repoUrl)}

Here is the relevant content from the source files (retrieved via semantic search):

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

  // Return sources with relevance scores from RAG
  const sources = chunks.map(c => ({
    path: c.path,
    relevance: 1 - (c.distance || 0), // Convert distance to relevance (lower distance = higher relevance)
  }));

  // Deduplicate sources, keeping highest relevance for each path
  const sourceMap = new Map();
  for (const source of sources) {
    if (!sourceMap.has(source.path) || sourceMap.get(source.path).relevance < source.relevance) {
      sourceMap.set(source.path, source);
    }
  }

  return { sources: Array.from(sourceMap.values()) };
}

/**
 * Generate content for a single product documentation page
 * Phase 2: Use RAG to find relevant code chunks and generate user-focused documentation
 */
async function* generateProductDocsPageContent(owner, repo, page, productName, options = {}) {
  // Use RAG to find relevant chunks
  const chunks = await getRelevantChunks(owner, repo, page, options);

  if (chunks.length === 0) {
    yield {
      type: 'content',
      chunk: `*No relevant content found for this page. Topic: ${page.title}*`,
    };
    return { sources: [] };
  }

  // Build context from RAG chunks
  const context = buildRagContext(chunks);

  // Get unique file paths from chunks for the prompt
  const filePaths = [...new Set(chunks.map(c => c.path))];

  // Generate page prompt using product docs prompt
  const userPrompt = `${getProductDocsPagePrompt(page.title, filePaths, productName)}

Here is the relevant content from the source files (retrieved via semantic search). Extract the USER-FACING information:

${context}

Generate the product documentation page content now. Remember to focus on the END USER perspective.`;

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

  // Return sources with relevance scores from RAG
  const sources = chunks.map(c => ({
    path: c.path,
    relevance: 1 - (c.distance || 0),
  }));

  // Deduplicate sources
  const sourceMap = new Map();
  for (const source of sources) {
    if (!sourceMap.has(source.path) || sourceMap.get(source.path).relevance < source.relevance) {
      sourceMap.set(source.path, source);
    }
  }

  return { sources: Array.from(sourceMap.values()) };
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
  const repoUrl = `https://github.com/${owner}/${repo}`;

  // Check if repository is indexed (required for RAG)
  const indexed = await isIndexed(owner, repo);
  if (!indexed) {
    yield { type: 'error', message: 'Repository must be indexed before generating documentation. Please index the repository first.' };
    return;
  }

  // Get metadata to find the branch
  const metadata = await getProjectMetadata(owner, repo);
  const branch = metadata?.branch || 'main';

  // Phase 1: Get/Generate structure
  yield { type: 'status', message: 'Analyzing codebase structure...' };

  let structure;
  try {
    structure = await getWikiStructure(owner, repo, branch, type, options);
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

    // Generate page content using RAG
    let sources = [];
    try {
      const generator = generatePageContent(owner, repo, page, repoUrl, options);
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
      logError(`Page generation error (${page.title}): ${error.message}`);
      yield { type: 'page_error', pageId: page.id, message: error.message };
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

/**
 * Generate product documentation with streaming events
 * Focused on end-user perspective, functionality, and features
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
export async function* generateProductDocs(owner, repo, options = {}) {
  // Check if repository is indexed (required for RAG)
  const indexed = await isIndexed(owner, repo);
  if (!indexed) {
    yield { type: 'error', message: 'Repository must be indexed before generating documentation. Please index the repository first.' };
    return;
  }

  // Get metadata to find the branch
  const metadata = await getProjectMetadata(owner, repo);
  const branch = metadata?.branch || 'main';

  // Phase 1: Get/Generate structure
  yield { type: 'status', message: 'Analyzing product features and functionality...' };

  let structure;
  try {
    structure = await getProductDocsStructure(owner, repo, branch, options);
  } catch (error) {
    yield { type: 'error', message: error.message };
    return;
  }

  // Send structure to frontend
  yield { type: 'structure', wiki: structure };

  yield { type: 'status', message: 'Generating user documentation...' };

  // Phase 2: Generate content for each page
  for (const page of structure.pages) {
    // Signal page start
    yield {
      type: 'page_start',
      pageId: page.id,
      title: page.title,
    };

    yield { type: 'status', message: `Generating: ${page.title}...` };

    // Generate page content using RAG
    let sources = [];
    try {
      const generator = generateProductDocsPageContent(owner, repo, page, structure.title, options);
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
      logError(`Product docs page generation error (${page.title}): ${error.message}`);
      yield { type: 'page_error', pageId: page.id, message: error.message };
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
