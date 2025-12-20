import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ErrorLog } from '@/components/ErrorLog'
import { MarkdownRenderer } from '@/components/MarkdownRenderer'
import {
  getProject,
  generateProductDocs,
  getServerLogs,
  clearServerLogs,
  type ProjectMetadata,
  type WikiStructure,
  type WikiSource,
} from '@/lib/api'
import {
  Loader2,
  ArrowLeft,
  Users,
  Copy,
  Check,
  AlertTriangle,
  RotateCw,
  FileText,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface PageState {
  status: 'pending' | 'generating' | 'complete' | 'error'
  content: string
  sources: WikiSource[]
  error?: string
}

interface WikiState {
  [pageId: string]: PageState
}

export default function ProductDocsPage() {
  const { owner, repo } = useParams<{ owner: string; repo: string }>()
  const [project, setProject] = useState<ProjectMetadata | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [generating, setGenerating] = useState(false)
  const [status, setStatus] = useState('')
  const [errors, setErrors] = useState<string[]>([])
  const [copied, setCopied] = useState(false)

  // Wiki state
  const [structure, setStructure] = useState<WikiStructure | null>(null)
  const [wikiState, setWikiState] = useState<WikiState>({})
  const [activePage, setActivePage] = useState<string>('')

  const contentRef = useRef<HTMLDivElement>(null)

  const cacheKey = `product_docs_${owner}_${repo}`

  const loadErrors = async () => {
    try {
      const logs = await getServerLogs()
      setErrors(logs)
    } catch {
      // Ignore errors fetching logs
    }
  }

  const handleClearErrors = async () => {
    await clearServerLogs()
    setErrors([])
  }

  const handleCopy = async () => {
    // Build markdown from all pages
    let markdown = `# ${structure?.title || `${owner}/${repo}`}\n\n`
    if (structure?.description) {
      markdown += `${structure.description}\n\n`
    }

    for (const page of structure?.pages || []) {
      const pageState = wikiState[page.id]
      if (pageState?.content) {
        markdown += pageState.content + '\n\n---\n\n'
      }
    }

    await navigator.clipboard.writeText(markdown)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Load cached docs on mount
  useEffect(() => {
    const cached = localStorage.getItem(cacheKey)
    if (cached) {
      try {
        const parsed = JSON.parse(cached)
        if (parsed.structure && parsed.wikiState) {
          setStructure(parsed.structure)
          setWikiState(parsed.wikiState)
          if (parsed.structure.pages.length > 0) {
            setActivePage(parsed.structure.pages[0].id)
          }
        }
      } catch {
        // Ignore parse errors
      }
    }
  }, [cacheKey])

  useEffect(() => {
    async function loadProject() {
      if (!owner || !repo) return

      try {
        const data = await getProject(owner, repo)
        setProject(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load project')
      } finally {
        setLoading(false)
      }
    }

    loadProject()
    loadErrors()

    const interval = setInterval(loadErrors, 5000)
    return () => clearInterval(interval)
  }, [owner, repo])

  const handleGenerate = async () => {
    if (!owner || !repo) return

    setGenerating(true)
    setError('')
    setStatus('Starting generation...')
    setStructure(null)
    setWikiState({})

    try {
      const generator = generateProductDocs(owner, repo)

      let currentPageId = ''
      let currentContent = ''

      for await (const event of generator) {
        switch (event.type) {
          case 'status':
            setStatus(event.message)
            break

          case 'structure':
            setStructure(event.wiki)
            // Initialize wiki state
            const initialState: WikiState = {}
            for (const page of event.wiki.pages) {
              initialState[page.id] = {
                status: 'pending',
                content: '',
                sources: [],
              }
            }
            setWikiState(initialState)
            // Set first page as active
            if (event.wiki.pages.length > 0) {
              setActivePage(event.wiki.pages[0].id)
            }
            break

          case 'page_start':
            currentPageId = event.pageId
            currentContent = ''
            setWikiState(prev => ({
              ...prev,
              [event.pageId]: {
                status: 'generating',
                content: '',
                sources: [],
              },
            }))
            // Navigate to this page
            setActivePage(event.pageId)
            setStatus(`Generating: ${event.title}...`)
            break

          case 'content':
            currentContent += event.chunk
            setWikiState(prev => ({
              ...prev,
              [currentPageId]: {
                ...prev[currentPageId],
                content: currentContent,
              },
            }))
            break

          case 'page_complete':
            setWikiState(prev => ({
              ...prev,
              [event.pageId]: {
                ...prev[event.pageId],
                status: 'complete',
                sources: event.sources,
              },
            }))
            break

          case 'page_error':
            setWikiState(prev => ({
              ...prev,
              [event.pageId]: {
                ...prev[event.pageId],
                status: 'error',
                error: event.message,
              },
            }))
            // Refresh error logs so the error shows in the toast
            loadErrors()
            break

          case 'complete':
            setStatus('')
            break

          case 'error':
            setError(event.message)
            break
        }
      }

      // Cache the result
      if (structure) {
        localStorage.setItem(cacheKey, JSON.stringify({
          structure,
          wikiState,
          generatedAt: new Date().toISOString(),
        }))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate product documentation')
      loadErrors()
    } finally {
      setGenerating(false)
      setStatus('')
    }
  }

  // Save to cache when wiki state changes
  useEffect(() => {
    if (structure && Object.keys(wikiState).length > 0 && !generating) {
      localStorage.setItem(cacheKey, JSON.stringify({
        structure,
        wikiState,
        generatedAt: new Date().toISOString(),
      }))
    }
  }, [structure, wikiState, generating, cacheKey])

  // Auto-generate on mount if no cached docs
  useEffect(() => {
    if (!loading && project && !structure && !generating) {
      handleGenerate()
    }
  }, [loading, project, structure])

  const scrollToPage = (pageId: string) => {
    setActivePage(pageId)
    const element = document.getElementById(`page-${pageId}`)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (error && !project) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 relative">
        <p className="text-destructive">{error}</p>
        <Link to={`/repo/${owner}/${repo}`}>
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Repository
          </Button>
        </Link>
      </div>
    )
  }

  const currentPageData = structure?.pages.find(p => p.id === activePage)
  const currentPageState = activePage ? wikiState[activePage] : null

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 p-4 border-b">
        <Link to={`/repo/${owner}/${repo}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Users className="h-5 w-5" />
            {structure?.title || `${owner}/${repo}`}
            <span className="text-sm font-normal text-muted-foreground ml-2">
              (Product Documentation)
            </span>
          </h1>
          {structure?.description && (
            <p className="text-sm text-muted-foreground">{structure.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {structure && !generating && (
            <Button onClick={handleGenerate} variant="outline" size="icon" title="Regenerate">
              <RotateCw className="h-4 w-4" />
            </Button>
          )}
          {structure && (
            <Button onClick={handleCopy} variant="outline">
              {copied ? (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="mr-2 h-4 w-4" />
                  Copy
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Embedding compatibility warning */}
      {project?.embeddingCompatibility && !project.embeddingCompatibility.compatible && (
        <Card className="mx-4 mt-4 border-yellow-500 bg-yellow-500/10">
          <CardContent className="py-3">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-yellow-600 dark:text-yellow-400">
                  Embedding model mismatch: {project.embeddingCompatibility.reason}
                </p>
              </div>
              <Link to={`/repo/${owner}/${repo}`}>
                <Button variant="outline" size="sm">Re-index</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status */}
      {status && (
        <div className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground border-b">
          <Loader2 className="h-4 w-4 animate-spin" />
          {status}
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        {structure && (
          <div className="w-64 border-r overflow-y-auto h-[calc(100vh-8rem)]">
            <div className="p-4 space-y-2">
              {structure.pages.map(page => {
                const pageState = wikiState[page.id]
                return (
                  <button
                    key={page.id}
                    className={cn(
                      "flex items-center gap-2 w-full text-left text-sm py-2 px-3 rounded",
                      activePage === page.id
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    )}
                    onClick={() => scrollToPage(page.id)}
                  >
                    {pageState?.status === 'generating' && (
                      <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
                    )}
                    {pageState?.status === 'complete' && (
                      <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                    )}
                    {pageState?.status === 'error' && (
                      <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0" />
                    )}
                    {pageState?.status === 'pending' && (
                      <FileText className="h-4 w-4 flex-shrink-0" />
                    )}
                    {!pageState && (
                      <FileText className="h-4 w-4 flex-shrink-0" />
                    )}
                    <span className="truncate">{page.title}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Content area */}
        <div className="flex-1 overflow-y-auto">
          <div ref={contentRef} className="p-6 max-w-4xl mx-auto">
            {!structure && !generating && (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">No product documentation generated yet.</p>
                <Button onClick={handleGenerate}>Generate Product Docs</Button>
              </div>
            )}

            {structure && currentPageData && (
              <div className="space-y-6" id={`page-${activePage}`}>
                {/* Page title and description */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <h2 className="text-2xl font-bold">{currentPageData.title}</h2>
                    {currentPageState?.status === 'generating' && (
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    )}
                  </div>
                  {currentPageData.description && (
                    <p className="text-muted-foreground">{currentPageData.description}</p>
                  )}
                </div>

                {/* Page content */}
                {currentPageState?.status === 'pending' && (
                  <div className="space-y-4">
                    <div className="h-8 bg-muted/30 rounded animate-pulse w-3/4" />
                    <div className="h-32 bg-muted/30 rounded animate-pulse" />
                    <div className="h-8 bg-muted/30 rounded animate-pulse w-1/2" />
                    <div className="h-24 bg-muted/30 rounded animate-pulse" />
                  </div>
                )}

                {currentPageState?.status === 'error' && (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
                    <p className="text-destructive font-medium mb-2">Failed to generate this page</p>
                    <p className="text-sm text-muted-foreground">
                      Check the error log for details. You can try regenerating the documentation.
                    </p>
                  </div>
                )}

                {(currentPageState?.status === 'generating' || currentPageState?.status === 'complete') && (
                  <MarkdownRenderer
                    content={currentPageState.content || ''}
                    className="prose-sm"
                  />
                )}

                {/* Sources */}
                {currentPageState?.status === 'complete' && currentPageState.sources.length > 0 && (
                  <details className="mt-8 border-t pt-4">
                    <summary className="text-sm text-muted-foreground cursor-pointer hover:text-foreground">
                      Source files analyzed ({currentPageState.sources.length})
                    </summary>
                    <div className="mt-3 space-y-1">
                      {currentPageState.sources.map((source, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between text-xs text-muted-foreground bg-muted/30 rounded px-3 py-2"
                        >
                          <code className="truncate">{source.path}</code>
                          <span className="text-green-600 ml-2">
                            {Math.round(source.relevance * 100)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            )}

            {/* Error message */}
            {error && (
              <div className="mt-4 p-4 bg-destructive/10 rounded text-destructive text-sm">
                {error}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Error Log */}
      {errors.length > 0 && (
        <div className="fixed bottom-4 right-4 w-96">
          <ErrorLog errors={errors} onClear={handleClearErrors} />
        </div>
      )}
    </div>
  )
}
