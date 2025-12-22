/**
 * Wiki documentation generator
 * Generates structured wiki documentation using RAG
 */
import { config } from './config.js';
import { streamChat } from './llm.js';
import { fetchRepositoryFiles, fetchReadmeContent, GitHubFile } from './github.js';
import { queryRag, buildRagContext, isIndexed, QueryOptions } from './ragQuery.js';
import { getProjectMetadata } from './vectorStore.js';
import {
  getStructureGenerationPrompt,
  getPageGenerationPrompt,
  briefWikiTemplate,
  detailedWikiTemplate,
  productDocsTemplate,
  getProductDocsStructurePrompt,
  getProductDocsPagePrompt,
  WikiStructure,
  WikiPage,
} from './wikiTemplates.js';
import { KeyEntry } from './api-key-pool.js';

/**
 * Number of chunks to retrieve from RAG for each wiki page
 */
const WIKI_CHUNK_LIMIT = 15;

/**
 * Maximum file tree size (in characters) to include in structure generation
 */
const MAX_FILE_TREE_CHARS = 10000;

/**
 * Maximum README size (in characters) to include in structure generation
 */
const MAX_README_CHARS = 8000;

export interface WikiOptions extends QueryOptions {
  model?: string;
}

export interface WikiEvent {
  type: 'status' | 'structure' | 'page_start' | 'content' | 'page_complete' | 'page_error' | 'error' | 'complete';
  message?: string;
  wiki?: WikiStructure;
  pageId?: string;
  title?: string;
  chunk?: string;
  sources?: Array<{ path: string; relevance: number }>;
}

/**
 * Get the file tree of a repository as a string
 */
async function getFileTree(
  owner: string,
  repo: string
): Promise<{ fileTree: string; files: GitHubFile[] }> {
  const { files } = await fetchRepositoryFiles(owner, repo);
  const paths = files.map((f) => f.path).sort();
  return { fileTree: paths.join('\n'), files };
}

/**
 * Get relevant chunks for a page using RAG vector search
 */
async function getRelevantChunks(
  owner: string,
  repo: string,
  page: WikiPage,
  options: WikiOptions = {}
) {
  const searchQuery = `${page.title}. ${page.description || ''}`;
  return queryRag(owner, repo, searchQuery, options, WIKI_CHUNK_LIMIT);
}

/**
 * Generate wiki structure using LLM
 */
async function generateWikiStructure(
  owner: string,
  repo: string,
  branch: string,
  isComprehensive: boolean,
  options: WikiOptions = {}
): Promise<WikiStructure> {
  const { fileTree: rawFileTree, files } = await getFileTree(owner, repo);
  let fileTree = rawFileTree;
  let readme = await fetchReadmeContent(owner, repo, branch);

  // Truncate if too long
  if (fileTree.length > MAX_FILE_TREE_CHARS) {
    fileTree = fileTree.slice(0, MAX_FILE_TREE_CHARS) + '\n... [truncated]';
    console.log(`[Wiki] File tree truncated from ${rawFileTree.length} to ${MAX_FILE_TREE_CHARS} chars`);
  }
  if (readme.length > MAX_README_CHARS) {
    readme = readme.slice(0, MAX_README_CHARS) + '\n... [truncated]';
    console.log(`[Wiki] README truncated to ${MAX_README_CHARS} chars`);
  }

  const prompt = getStructureGenerationPrompt(owner, repo, fileTree, readme, isComprehensive);
  console.log(`[Wiki] Structure prompt size: ${prompt.length} chars (~${Math.ceil(prompt.length / 4)} tokens)`);

  const messages = [{ role: 'user' as const, content: prompt }];

  let structureJson = '';
  for await (const chunk of streamChat(
    'You are a technical documentation expert.',
    messages,
    options.apiKeys,
    options.model
  )) {
    structureJson += chunk;
  }

  // Clean up potential markdown code blocks
  structureJson = structureJson.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  try {
    const structure = JSON.parse(structureJson) as WikiStructure;

    if (!structure.title || !structure.pages || !Array.isArray(structure.pages)) {
      throw new Error('Invalid structure format');
    }

    // Ensure each page has required fields
    for (let i = 0; i < structure.pages.length; i++) {
      const page = structure.pages[i];
      page.id = page.id || `page-${i + 1}`;
      page.title = page.title || 'Untitled';
      page.filePaths = page.filePaths || [];
      page.relatedPages = page.relatedPages || [];
      page.importance = page.importance || 'medium';
    }

    return structure;
  } catch (e) {
    console.error('Failed to parse wiki structure:', (e as Error).message);
    console.error('Raw response:', structureJson.slice(0, 500));
    throw new Error(`Failed to parse wiki structure: ${(e as Error).message}`);
  }
}

/**
 * Generate product documentation structure using LLM
 */
async function generateProductDocsStructure(
  owner: string,
  repo: string,
  branch: string,
  options: WikiOptions = {}
): Promise<WikiStructure> {
  const { fileTree: rawFileTree } = await getFileTree(owner, repo);
  let fileTree = rawFileTree;
  let readme = await fetchReadmeContent(owner, repo, branch);

  if (fileTree.length > MAX_FILE_TREE_CHARS) {
    fileTree = fileTree.slice(0, MAX_FILE_TREE_CHARS) + '\n... [truncated]';
  }
  if (readme.length > MAX_README_CHARS) {
    readme = readme.slice(0, MAX_README_CHARS) + '\n... [truncated]';
  }

  const prompt = getProductDocsStructurePrompt(owner, repo, fileTree, readme);
  const messages = [{ role: 'user' as const, content: prompt }];

  let structureJson = '';
  for await (const chunk of streamChat(
    'You are a product documentation expert focused on end-user experience.',
    messages,
    options.apiKeys,
    options.model
  )) {
    structureJson += chunk;
  }

  structureJson = structureJson.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  try {
    const structure = JSON.parse(structureJson) as WikiStructure;

    if (!structure.title || !structure.pages || !Array.isArray(structure.pages)) {
      throw new Error('Invalid structure format');
    }

    for (let i = 0; i < structure.pages.length; i++) {
      const page = structure.pages[i];
      page.id = page.id || `page-${i + 1}`;
      page.title = page.title || 'Untitled';
      page.filePaths = page.filePaths || [];
      page.relatedPages = page.relatedPages || [];
      page.importance = page.importance || 'medium';
    }

    return structure;
  } catch (e) {
    console.error('Failed to parse product docs structure:', (e as Error).message);
    throw new Error(`Failed to parse product docs structure: ${(e as Error).message}`);
  }
}

/**
 * Get wiki structure (LLM-generated or template fallback)
 */
async function getWikiStructure(
  owner: string,
  repo: string,
  branch: string,
  type: string,
  options: WikiOptions = {}
): Promise<WikiStructure> {
  const isComprehensive = type === 'detailed';

  try {
    return await generateWikiStructure(owner, repo, branch, isComprehensive, options);
  } catch (error) {
    console.warn('LLM structure generation failed, using template fallback:', (error as Error).message);

    const template = isComprehensive
      ? JSON.parse(JSON.stringify(detailedWikiTemplate))
      : JSON.parse(JSON.stringify(briefWikiTemplate));

    template.title = `${owner}/${repo}`;
    template.description = `Documentation for ${owner}/${repo}`;

    // Populate file paths from repository
    const { files } = await fetchRepositoryFiles(owner, repo);
    const allPaths = files.map((f) => f.path);

    for (const page of template.pages) {
      if (page.id === 'overview' || page.id === 'getting-started') {
        page.filePaths = allPaths
          .filter((p) => p.toLowerCase().includes('readme') || p.includes('package.json') || p.includes('index.'))
          .slice(0, 5);
      } else if (page.id === 'architecture') {
        page.filePaths = allPaths.filter((p) => p.includes('src/') || p.includes('lib/') || p.includes('app/')).slice(0, 8);
      } else if (page.id === 'api-reference') {
        page.filePaths = allPaths
          .filter((p) => p.includes('routes') || p.includes('api') || p.includes('controller'))
          .slice(0, 8);
      } else if (page.id === 'configuration') {
        page.filePaths = allPaths.filter((p) => p.includes('config') || p.includes('.env') || p.includes('settings')).slice(0, 5);
      } else {
        page.filePaths = allPaths.slice(0, 5);
      }
    }

    return template;
  }
}

/**
 * Get product documentation structure
 */
async function getProductDocsStructure(
  owner: string,
  repo: string,
  branch: string,
  options: WikiOptions = {}
): Promise<WikiStructure> {
  try {
    return await generateProductDocsStructure(owner, repo, branch, options);
  } catch (error) {
    console.warn('LLM product docs structure generation failed, using template fallback:', (error as Error).message);

    const template = JSON.parse(JSON.stringify(productDocsTemplate));
    template.title = `${owner}/${repo} - User Guide`;
    template.description = `User documentation for ${owner}/${repo}`;

    const { files } = await fetchRepositoryFiles(owner, repo);
    const allPaths = files.map((f) => f.path);

    for (const page of template.pages) {
      if (page.id === 'overview' || page.id === 'quick-start') {
        page.filePaths = allPaths
          .filter((p) => p.toLowerCase().includes('readme') || p.includes('package.json') || p.includes('index.'))
          .slice(0, 5);
      } else if (page.id === 'features') {
        page.filePaths = allPaths
          .filter(
            (p) =>
              p.includes('components/') || p.includes('pages/') || p.includes('features/') || p.includes('services/')
          )
          .slice(0, 8);
      } else if (page.id === 'settings') {
        page.filePaths = allPaths.filter((p) => p.includes('config') || p.includes('settings')).slice(0, 6);
      } else {
        page.filePaths = allPaths.slice(0, 5);
      }
    }

    return template;
  }
}

/**
 * Generate content for a single wiki page
 */
async function* generatePageContent(
  owner: string,
  repo: string,
  page: WikiPage,
  repoUrl: string,
  options: WikiOptions = {}
): AsyncGenerator<WikiEvent, { sources: Array<{ path: string; relevance: number }> }> {
  const chunks = await getRelevantChunks(owner, repo, page, options);

  if (chunks.length === 0) {
    yield {
      type: 'content',
      chunk: `*No relevant content found for this page. Topic: ${page.title}*`,
    };
    return { sources: [] };
  }

  const context = buildRagContext(chunks);
  const filePaths = [...new Set(chunks.map((c) => c.path))];

  const userPrompt = `${getPageGenerationPrompt(page.title, filePaths, repoUrl)}

Here is the relevant content from the source files (retrieved via semantic search):

${context}

Generate the wiki page content now.`;

  const messages = [{ role: 'user' as const, content: userPrompt }];

  for await (const chunk of streamChat('', messages, options.apiKeys, options.model)) {
    yield { type: 'content', chunk };
  }

  const sources = chunks.map((c) => ({
    path: c.path,
    relevance: 1 - (c.distance || 0),
  }));

  const sourceMap = new Map<string, { path: string; relevance: number }>();
  for (const source of sources) {
    if (!sourceMap.has(source.path) || sourceMap.get(source.path)!.relevance < source.relevance) {
      sourceMap.set(source.path, source);
    }
  }

  return { sources: Array.from(sourceMap.values()) };
}

/**
 * Generate content for a single product documentation page
 */
async function* generateProductDocsPageContent(
  owner: string,
  repo: string,
  page: WikiPage,
  productName: string,
  options: WikiOptions = {}
): AsyncGenerator<WikiEvent, { sources: Array<{ path: string; relevance: number }> }> {
  const chunks = await getRelevantChunks(owner, repo, page, options);

  if (chunks.length === 0) {
    yield {
      type: 'content',
      chunk: `*No relevant content found for this page. Topic: ${page.title}*`,
    };
    return { sources: [] };
  }

  const context = buildRagContext(chunks);
  const filePaths = [...new Set(chunks.map((c) => c.path))];

  const userPrompt = `${getProductDocsPagePrompt(page.title, filePaths, productName)}

Here is the relevant content from the source files (retrieved via semantic search). Extract the USER-FACING information:

${context}

Generate the product documentation page content now. Remember to focus on the END USER perspective.`;

  const messages = [{ role: 'user' as const, content: userPrompt }];

  for await (const chunk of streamChat('', messages, options.apiKeys, options.model)) {
    yield { type: 'content', chunk };
  }

  const sources = chunks.map((c) => ({
    path: c.path,
    relevance: 1 - (c.distance || 0),
  }));

  const sourceMap = new Map<string, { path: string; relevance: number }>();
  for (const source of sources) {
    if (!sourceMap.has(source.path) || sourceMap.get(source.path)!.relevance < source.relevance) {
      sourceMap.set(source.path, source);
    }
  }

  return { sources: Array.from(sourceMap.values()) };
}

/**
 * Generate wiki documentation with streaming events
 */
export async function* generateWiki(
  owner: string,
  repo: string,
  type: string = 'detailed',
  options: WikiOptions = {}
): AsyncGenerator<WikiEvent> {
  const repoUrl = `https://github.com/${owner}/${repo}`;

  const indexed = await isIndexed(owner, repo);
  if (!indexed) {
    yield {
      type: 'error',
      message: 'Repository must be indexed before generating documentation. Please index the repository first.',
    };
    return;
  }

  const metadata = await getProjectMetadata(owner, repo);
  const branch = metadata?.branch || 'main';

  yield { type: 'status', message: 'Analyzing codebase structure...' };

  let structure: WikiStructure;
  try {
    structure = await getWikiStructure(owner, repo, branch, type, options);
  } catch (error) {
    yield { type: 'error', message: (error as Error).message };
    return;
  }

  yield { type: 'structure', wiki: structure };
  yield { type: 'status', message: 'Generating documentation...' };

  for (const page of structure.pages) {
    yield { type: 'page_start', pageId: page.id, title: page.title };
    yield { type: 'status', message: `Generating: ${page.title}...` };

    let sources: Array<{ path: string; relevance: number }> = [];
    try {
      const generator = generatePageContent(owner, repo, page, repoUrl, options);
      let result = await generator.next();

      while (!result.done) {
        yield result.value;
        result = await generator.next();
      }

      if (result.value && result.value.sources) {
        sources = result.value.sources;
      }
    } catch (error) {
      console.error(`Page generation error (${page.title}):`, (error as Error).message);
      yield { type: 'page_error', pageId: page.id, message: (error as Error).message };
    }

    yield { type: 'page_complete', pageId: page.id, sources };
  }

  yield { type: 'complete' };
}

/**
 * Generate brief wiki
 */
export async function* generateBriefWiki(
  owner: string,
  repo: string,
  options: WikiOptions = {}
): AsyncGenerator<WikiEvent> {
  yield* generateWiki(owner, repo, 'brief', options);
}

/**
 * Generate detailed wiki
 */
export async function* generateDetailedWiki(
  owner: string,
  repo: string,
  options: WikiOptions = {}
): AsyncGenerator<WikiEvent> {
  yield* generateWiki(owner, repo, 'detailed', options);
}

/**
 * Generate product documentation with streaming events
 */
export async function* generateProductDocs(
  owner: string,
  repo: string,
  options: WikiOptions = {}
): AsyncGenerator<WikiEvent> {
  const indexed = await isIndexed(owner, repo);
  if (!indexed) {
    yield {
      type: 'error',
      message: 'Repository must be indexed before generating documentation. Please index the repository first.',
    };
    return;
  }

  const metadata = await getProjectMetadata(owner, repo);
  const branch = metadata?.branch || 'main';

  yield { type: 'status', message: 'Analyzing product features and functionality...' };

  let structure: WikiStructure;
  try {
    structure = await getProductDocsStructure(owner, repo, branch, options);
  } catch (error) {
    yield { type: 'error', message: (error as Error).message };
    return;
  }

  yield { type: 'structure', wiki: structure };
  yield { type: 'status', message: 'Generating user documentation...' };

  for (const page of structure.pages) {
    yield { type: 'page_start', pageId: page.id, title: page.title };
    yield { type: 'status', message: `Generating: ${page.title}...` };

    let sources: Array<{ path: string; relevance: number }> = [];
    try {
      const generator = generateProductDocsPageContent(owner, repo, page, structure.title, options);
      let result = await generator.next();

      while (!result.done) {
        yield result.value;
        result = await generator.next();
      }

      if (result.value && result.value.sources) {
        sources = result.value.sources;
      }
    } catch (error) {
      console.error(`Product docs page generation error (${page.title}):`, (error as Error).message);
      yield { type: 'page_error', pageId: page.id, message: (error as Error).message };
    }

    yield { type: 'page_complete', pageId: page.id, sources };
  }

  yield { type: 'complete' };
}
