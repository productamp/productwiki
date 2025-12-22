import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { MarkdownRenderer } from '@/components/MarkdownRenderer'
import { AppHeader } from '@/components/AppHeader'
import {
  getProject,
  generateBriefWiki,
  generateDetailedWiki,
  JobIds,
  type ProjectMetadata,
  type WikiStructure,
  type WikiSource,
  type WikiEvent,
} from '@/lib/api'
import { useWikiJobReconnection } from '@/hooks/useJobReconnection'
import {
  Loader2,
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

export default function WikiPage() {
  const { owner, repo, type } = useParams<{ owner: string; repo: string; type: string }>()
  const [project, setProject] = useState<ProjectMetadata | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [generating, setGenerating] = useState(false)
  const [status, setStatus] = useState('')
  const [copied, setCopied] = useState(false)

  // Wiki state
  const [structure, setStructure] = useState<WikiStructure | null>(null)
  const [wikiState, setWikiState] = useState<WikiState>({})
  const [activePage, setActivePage] = useState<string>('')
  const [cacheChecked, setCacheChecked] = useState(false)

  const contentRef = useRef<HTMLDivElement>(null)

  const wikiType = type === 'brief' ? 'brief' : 'detailed'
  const cacheKey = `wiki_${wikiType}_${owner}_${repo}`

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

  // Process wiki events to update state
  const processEvent = (event: WikiEvent, currentPageIdRef: { value: string }, currentContentRef: { value: string }) => {
    switch (event.type) {
      case 'status':
        setStatus(event.message)
        break

      case 'structure':
        setStructure(event.wiki)
        const initialState: WikiState = {}
        for (const page of event.wiki.pages) {
          initialState[page.id] = {
            status: 'pending',
            content: '',
            sources: [],
          }
        }
        setWikiState(initialState)
        if (event.wiki.pages.length > 0) {
          setActivePage(event.wiki.pages[0].id)
        }
        break

      case 'page_start':
        currentPageIdRef.value = event.pageId
        currentContentRef.value = ''
        setWikiState(prev => ({
          ...prev,
          [event.pageId]: {
            status: 'generating',
            content: '',
            sources: [],
          },
        }))
        setActivePage(event.pageId)
        setStatus(`Generating: ${event.title}...`)
        break

      case 'content':
        currentContentRef.value += event.chunk
        setWikiState(prev => ({
          ...prev,
          [currentPageIdRef.value]: {
            ...prev[currentPageIdRef.value],
            content: currentContentRef.value,
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
        break

      case 'complete':
        setStatus('')
        break

      case 'error':
        setError(event.message)
        break
    }
  }

  // Load cached wiki on mount and check for running job
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
    setCacheChecked(true)
  }, [cacheKey])

  // Check for running job and reconnect if needed
  const { reconnecting, status: reconnectStatus } = useWikiJobReconnection({
    jobId: owner && repo
      ? (wikiType === 'brief' ? JobIds.briefWiki(owner, repo) : JobIds.detailedWiki(owner, repo))
      : '',
    generator: () => wikiType === 'brief'
      ? generateBriefWiki(owner!, repo!)
      : generateDetailedWiki(owner!, repo!),
    processEvent,
    enabled: cacheChecked && !!owner && !!repo,
  })

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
  }, [owner, repo])

  const handleGenerate = async () => {
    if (!owner || !repo) return

    setGenerating(true)
    setError('')
    setStatus('Starting generation...')
    setStructure(null)
    setWikiState({})

    try {
      const generator = wikiType === 'brief'
        ? generateBriefWiki(owner, repo)
        : generateDetailedWiki(owner, repo)

      const currentPageIdRef = { value: '' }
      const currentContentRef = { value: '' }

      for await (const event of generator) {
        processEvent(event, currentPageIdRef, currentContentRef)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate wiki')
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

  // Auto-generate on mount if no cached wiki
  useEffect(() => {
    // Wait for cache check to complete before deciding to auto-generate
    if (!loading && project && !structure && !generating && cacheChecked) {
      handleGenerate()
    }
  }, [loading, project, structure, generating, cacheChecked])

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
      <AppHeader
        title={`${owner}/${repo}`}
        subtitle="Technical Documentation"
        actions={
          <>
            {structure && !generating && !reconnecting && (
              <Button onClick={handleGenerate} variant="outline" size="icon" title="Regenerate">
                <RotateCw className="h-4 w-4" />
              </Button>
            )}
            {structure && (
              <Button onClick={handleCopy} variant="outline" size="sm">
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
          </>
        }
      />

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
      {(status || reconnectStatus) && (
        <div className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground border-b">
          <Loader2 className="h-4 w-4 animate-spin" />
          {reconnectStatus || status}
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
                <p className="text-muted-foreground mb-4">No wiki generated yet.</p>
                <Button onClick={handleGenerate}>Generate Wiki</Button>
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
                      Check the error log for details. You can try regenerating the wiki.
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
                      Source files used ({currentPageState.sources.length})
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
    </div>
  )
}
