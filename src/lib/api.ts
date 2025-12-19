const BASE_URL = 'http://localhost:3001'
const API_KEY_STORAGE_KEY = 'productwiki_api_key'

export interface ProjectMetadata {
  owner: string
  repo: string
  url: string
  indexedAt: string
  fileCount: number
  chunkCount: number
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

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  const apiKey = getApiKey()
  if (apiKey) {
    headers['X-API-Key'] = apiKey
  }
  return headers
}

export async function indexRepo(url: string): Promise<ProjectMetadata> {
  const response = await fetch(`${BASE_URL}/index`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ url }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to index repository')
  }

  return response.json()
}

export async function getProjects(): Promise<ProjectMetadata[]> {
  const response = await fetch(`${BASE_URL}/projects`)

  if (!response.ok) {
    throw new Error('Failed to fetch projects')
  }

  return response.json()
}

export async function getProject(owner: string, repo: string): Promise<ProjectMetadata> {
  const response = await fetch(`${BASE_URL}/projects/${owner}/${repo}`)

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
