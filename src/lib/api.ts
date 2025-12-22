const BASE_URL = import.meta.env.VITE_API_URL || window.location.origin
const API_KEY_STORAGE_KEY = 'productwiki_api_key'
const API_KEYS_STORAGE_KEY = 'productwiki_api_keys'
const PROVIDER_STORAGE_KEY = 'productwiki_llm_provider'
const GEMINI_MODEL_STORAGE_KEY = 'productwiki_gemini_model'

export const DEFAULT_GEMINI_MODEL = 'gemma-3-27b-it'

export type LlmProvider = 'gemini' | 'ollama'

export interface ApiKeyEntry {
  key: string
  label: string
}

export interface EmbeddingInfo {
  provider: string
  model: string
  dimensions: number
}

export interface EmbeddingCompatibility {
  compatible: boolean
  reason?: string
}

// Wiki structure types (matching DeepWiki format)
export interface WikiPage {
  id: string
  title: string
  description?: string
  importance?: 'high' | 'medium' | 'low'
  filePaths: string[]
  relatedPages?: string[]
}

export interface WikiStructure {
  title: string
  description: string
  pages: WikiPage[]
}

export interface WikiSource {
  path: string
  relevance: number
}

// Wiki generation event types
export type WikiEvent =
  | { type: 'status'; message: string }
  | { type: 'structure'; wiki: WikiStructure }
  | { type: 'page_start'; pageId: string; title: string }
  | { type: 'content'; chunk: string }
  | { type: 'page_complete'; pageId: string; sources: WikiSource[] }
  | { type: 'page_error'; pageId: string; message: string }
  | { type: 'complete' }
  | { type: 'error'; message: string }

export interface ProjectMetadata {
  owner: string
  repo: string
  url: string
  indexedAt: string
  fileCount: number
  chunkCount: number
  embedding?: EmbeddingInfo
  embeddingCompatibility?: EmbeddingCompatibility
}

export function getApiKey(): string | null {
  return localStorage.getItem(API_KEY_STORAGE_KEY)
}

export function setApiKey(key: string): void {
  if (key) {
    localStorage.setItem(API_KEY_STORAGE_KEY, key)
  } else {
    localStorage.removeItem(API_KEY_STORAGE_KEY)
  }
}

export function getApiKeyEntries(): ApiKeyEntry[] {
  const stored = localStorage.getItem(API_KEYS_STORAGE_KEY)
  if (stored) {
    try {
      const parsed = JSON.parse(stored)
      // Check if it's the old format (array of strings)
      if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'string') {
        // Migrate to new format
        return parsed.map((key: string, i: number) => ({
          key,
          label: `Key ${i + 1}`,
        }))
      }
      // New format
      return parsed as ApiKeyEntry[]
    } catch {
      return []
    }
  }
  // Migrate from single key if exists
  const singleKey = getApiKey()
  return singleKey ? [{ key: singleKey, label: 'Key 1' }] : []
}

export function setApiKeyEntries(entries: ApiKeyEntry[]): void {
  const filtered = entries.filter(e => e.key.trim())
  if (filtered.length > 0) {
    localStorage.setItem(API_KEYS_STORAGE_KEY, JSON.stringify(filtered))
    // Also set first key for backwards compat
    setApiKey(filtered[0].key)
  } else {
    localStorage.removeItem(API_KEYS_STORAGE_KEY)
    localStorage.removeItem(API_KEY_STORAGE_KEY)
  }
}

// Legacy functions for backwards compatibility
export function getApiKeys(): string[] {
  return getApiKeyEntries().map(e => e.key)
}

export function setApiKeys(keys: string[]): void {
  const entries = keys.map((key, i) => ({ key, label: `Key ${i + 1}` }))
  setApiKeyEntries(entries)
}

export function getProvider(): LlmProvider {
  return (localStorage.getItem(PROVIDER_STORAGE_KEY) as LlmProvider) || 'gemini'
}

export function setProvider(provider: LlmProvider): void {
  localStorage.setItem(PROVIDER_STORAGE_KEY, provider)
}

export function getGeminiModel(): string {
  return localStorage.getItem(GEMINI_MODEL_STORAGE_KEY) || DEFAULT_GEMINI_MODEL
}

export function setGeminiModel(model: string): void {
  if (model) {
    localStorage.setItem(GEMINI_MODEL_STORAGE_KEY, model)
  } else {
    localStorage.removeItem(GEMINI_MODEL_STORAGE_KEY)
  }
}

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  const apiKeyEntries = getApiKeyEntries()
  if (apiKeyEntries.length > 0) {
    headers['X-API-Keys'] = JSON.stringify(apiKeyEntries)
    // Also set single key for backwards compat
    headers['X-API-Key'] = apiKeyEntries[0].key
  }
  const provider = getProvider()
  headers['X-LLM-Provider'] = provider
  const geminiModel = getGeminiModel()
  headers['X-Gemini-Model'] = geminiModel
  return headers
}

export type IndexProgress =
  | { phase: 'clone'; status: 'started' | 'completed' }
  | { phase: 'extract'; status: 'completed'; fileCount: number }
  | { phase: 'chunk'; status: 'completed'; chunkCount: number }
  | { phase: 'embed'; status: 'progress'; current: number; total: number }
  | { phase: 'embed'; status: 'completed' }
  | { phase: 'store'; status: 'started' | 'completed' }
  | { phase: 'complete'; metadata: ProjectMetadata }
  | { phase: 'error'; error: string }
  | { phase: 'cancelled' }
  | { phase: 'done' }

export async function* indexRepoStream(
  url: string,
  signal?: AbortSignal
): AsyncGenerator<IndexProgress> {
  const response = await fetch(`${BASE_URL}/index`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ url }),
    signal,
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to index repository')
  }

  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('No response body')
  }

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()

    if (done) break

    buffer += decoder.decode(value, { stream: true })

    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6)
        try {
          const parsed = JSON.parse(data) as IndexProgress
          yield parsed
          if (parsed.phase === 'done' || parsed.phase === 'error' || parsed.phase === 'cancelled') {
            return
          }
        } catch {
          // Skip non-JSON lines
        }
      }
    }
  }
}

export async function indexRepo(url: string): Promise<ProjectMetadata> {
  const generator = indexRepoStream(url)
  let metadata: ProjectMetadata | undefined

  for await (const event of generator) {
    if (event.phase === 'complete') {
      metadata = event.metadata
    }
    if (event.phase === 'error') {
      throw new Error(event.error)
    }
  }

  if (!metadata) {
    throw new Error('Indexing completed without metadata')
  }

  return metadata
}

export async function getProjects(): Promise<ProjectMetadata[]> {
  const response = await fetch(`${BASE_URL}/projects`, {
    headers: getHeaders(),
  })

  if (!response.ok) {
    throw new Error('Failed to fetch projects')
  }

  return response.json()
}

export async function getProject(owner: string, repo: string): Promise<ProjectMetadata> {
  const response = await fetch(`${BASE_URL}/projects/${owner}/${repo}`, {
    headers: getHeaders(),
  })

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Project not found')
    }
    throw new Error('Failed to fetch project')
  }

  return response.json()
}

export async function getIndexStatus(owner: string, repo: string): Promise<{ indexed: boolean }> {
  const response = await fetch(`${BASE_URL}/index/status/${owner}/${repo}`)

  if (!response.ok) {
    throw new Error('Failed to check index status')
  }

  return response.json()
}

export async function* generateDocs(owner: string, repo: string): AsyncGenerator<string> {
  const response = await fetch(`${BASE_URL}/generate/docs`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ owner, repo }),
  })

  if (!response.ok) {
    throw new Error('Failed to generate documentation')
  }

  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('No response body')
  }

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()

    if (done) break

    buffer += decoder.decode(value, { stream: true })

    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6)

        if (data === '[DONE]') {
          return
        }

        try {
          const parsed = JSON.parse(data)
          if (parsed.content) {
            yield parsed.content
          }
          if (parsed.error) {
            throw new Error(parsed.error)
          }
        } catch (e) {
          if (e instanceof Error && e.message !== 'Unexpected end of JSON input') {
            throw e
          }
        }
      }
    }
  }
}

export async function getServerLogs(): Promise<string[]> {
  const response = await fetch(`${BASE_URL}/logs`)

  if (!response.ok) {
    return []
  }

  const data = await response.json()
  return data.logs || []
}

export async function clearServerLogs(): Promise<void> {
  await fetch(`${BASE_URL}/logs`, { method: 'DELETE' })
}

export async function* generatePackagePrompt(owner: string, repo: string): AsyncGenerator<string> {
  const response = await fetch(`${BASE_URL}/generate/package-prompt`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ owner, repo }),
  })

  if (!response.ok) {
    throw new Error('Failed to generate package prompt')
  }

  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('No response body')
  }

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()

    if (done) break

    buffer += decoder.decode(value, { stream: true })

    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6)

        if (data === '[DONE]') {
          return
        }

        try {
          const parsed = JSON.parse(data)
          if (parsed.content) {
            yield parsed.content
          }
          if (parsed.error) {
            throw new Error(parsed.error)
          }
        } catch (e) {
          if (e instanceof Error && e.message !== 'Unexpected end of JSON input') {
            throw e
          }
        }
      }
    }
  }
}

export async function* generateReimplementPrompt(owner: string, repo: string): AsyncGenerator<string> {
  const response = await fetch(`${BASE_URL}/generate/reimplement-prompt`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ owner, repo }),
  })

  if (!response.ok) {
    throw new Error('Failed to generate reimplement prompt')
  }

  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('No response body')
  }

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()

    if (done) break

    buffer += decoder.decode(value, { stream: true })

    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6)

        if (data === '[DONE]') {
          return
        }

        try {
          const parsed = JSON.parse(data)
          if (parsed.content) {
            yield parsed.content
          }
          if (parsed.error) {
            throw new Error(parsed.error)
          }
        } catch (e) {
          if (e instanceof Error && e.message !== 'Unexpected end of JSON input') {
            throw e
          }
        }
      }
    }
  }
}

// Wiki generation functions
export type WikiType = 'brief' | 'detailed' | 'dynamic' | 'product-docs'

async function* generateWikiInternal(
  owner: string,
  repo: string,
  type: WikiType
): AsyncGenerator<WikiEvent> {
  const endpoint = `${BASE_URL}/wiki/${type}`

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ owner, repo }),
  })

  if (!response.ok) {
    throw new Error(`Failed to generate ${type} wiki`)
  }

  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('No response body')
  }

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()

    if (done) break

    buffer += decoder.decode(value, { stream: true })

    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6)

        if (data === '[DONE]') {
          return
        }

        try {
          const parsed = JSON.parse(data) as WikiEvent
          yield parsed
          if (parsed.type === 'complete' || parsed.type === 'error') {
            return
          }
        } catch (e) {
          if (e instanceof Error && e.message !== 'Unexpected end of JSON input') {
            throw e
          }
        }
      }
    }
  }
}

export async function* generateBriefWiki(
  owner: string,
  repo: string
): AsyncGenerator<WikiEvent> {
  yield* generateWikiInternal(owner, repo, 'brief')
}

export async function* generateDetailedWiki(
  owner: string,
  repo: string
): AsyncGenerator<WikiEvent> {
  yield* generateWikiInternal(owner, repo, 'detailed')
}

export async function* generateDynamicWiki(
  owner: string,
  repo: string
): AsyncGenerator<WikiEvent> {
  yield* generateWikiInternal(owner, repo, 'dynamic')
}

export async function* generateProductDocs(
  owner: string,
  repo: string
): AsyncGenerator<WikiEvent> {
  yield* generateWikiInternal(owner, repo, 'product-docs')
}

// Job status types
export type JobStatus = 'running' | 'complete' | 'error' | 'not_found'

export interface JobStatusResponse {
  status: JobStatus
  eventCount?: number
}

export interface JobEventsResponse {
  status: JobStatus
  events: WikiEvent[] | Array<{ content?: string; error?: string }>
}

/**
 * Get the status of a running job
 */
export async function getJobStatus(jobId: string): Promise<JobStatusResponse> {
  const response = await fetch(`${BASE_URL}/jobs/${encodeURIComponent(jobId)}/status`)
  if (!response.ok) {
    throw new Error('Failed to get job status')
  }
  return response.json()
}

/**
 * Get all buffered events for a job (for state recovery)
 */
export async function getJobEvents(jobId: string): Promise<JobEventsResponse> {
  const response = await fetch(`${BASE_URL}/jobs/${encodeURIComponent(jobId)}/events`)
  if (!response.ok) {
    throw new Error('Failed to get job events')
  }
  return response.json()
}

/**
 * Job ID builders for different generation types
 */
export const JobIds = {
  briefWiki: (owner: string, repo: string) => `wiki_brief_${owner}_${repo}`,
  detailedWiki: (owner: string, repo: string) => `wiki_detailed_${owner}_${repo}`,
  dynamicWiki: (owner: string, repo: string) => `wiki_dynamic_${owner}_${repo}`,
  productDocs: (owner: string, repo: string) => `wiki_product-docs_${owner}_${repo}`,
  docs: (owner: string, repo: string) => `generate_docs_${owner}_${repo}`,
  packagePrompt: (owner: string, repo: string) => `generate_package-prompt_${owner}_${repo}`,
  reimplementPrompt: (owner: string, repo: string) => `generate_reimplement-prompt_${owner}_${repo}`,
}
