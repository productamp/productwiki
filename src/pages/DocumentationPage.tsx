import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { DocumentationViewer } from '@/components/DocumentationViewer'
import { AppHeader } from '@/components/AppHeader'
import { getProject, generateDocs, JobIds, type ProjectMetadata } from '@/lib/api'
import { useSimpleJobReconnection } from '@/hooks/useJobReconnection'
import { Loader2, Copy, Check, AlertTriangle, RotateCw } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

export default function DocumentationPage() {
  const { owner, repo } = useParams<{ owner: string; repo: string }>()
  const [project, setProject] = useState<ProjectMetadata | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [docs, setDocs] = useState('')
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(docs)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  useEffect(() => {
    async function loadProject() {
      if (!owner || !repo) return

      try {
        // Check localStorage for cached docs
        const cachedDocs = localStorage.getItem(`docs_${owner}_${repo}`)
        if (cachedDocs) {
          setDocs(cachedDocs)
        }

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

  // Check for running job and reconnect if needed
  const { reconnecting } = useSimpleJobReconnection({
    jobId: owner && repo ? JobIds.docs(owner, repo) : '',
    generator: () => generateDocs(owner!, repo!),
    onContent: setDocs,
    cacheKey: `docs_${owner}_${repo}`,
    enabled: !loading && !!owner && !!repo,
  })

  const handleGenerate = async () => {
    if (!owner || !repo) return

    setGenerating(true)
    setDocs('')
    setError('')

    try {
      let fullContent = ''

      for await (const chunk of generateDocs(owner, repo)) {
        fullContent += chunk
        setDocs(fullContent)
      }

      localStorage.setItem(`docs_${owner}_${repo}`, fullContent)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate documentation')
    } finally {
      setGenerating(false)
    }
  }

  // Auto-generate on mount if no cached docs
  useEffect(() => {
    if (!loading && project && !docs && !generating) {
      handleGenerate()
    }
  }, [loading, project])

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

  return (
    <div className="min-h-screen bg-background relative">
      <AppHeader
        title={`${owner}/${repo}`}
        titleHref={`/repo/${owner}/${repo}`}
        subtitle="Quick Documentation"
        actions={
          <>
            {docs && !generating && (
              <Button onClick={handleGenerate} variant="outline" size="icon" title="Regenerate">
                <RotateCw className="h-4 w-4" />
              </Button>
            )}
            {docs && (
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

      {/* Content */}
      <div className="max-w-6xl mx-auto px-8 py-6 space-y-6">
        {/* Embedding compatibility warning */}
        {project?.embeddingCompatibility && !project.embeddingCompatibility.compatible && (
          <Card className="border-yellow-500 bg-yellow-500/10">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-yellow-600 dark:text-yellow-400">
                    Embedding Model Mismatch
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {project.embeddingCompatibility.reason} Generation may produce poor results.
                  </p>
                  <Link to={`/repo/${owner}/${repo}`} className="inline-block mt-2">
                    <Button variant="outline" size="sm">
                      Re-index Repository
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Status */}
        {(generating || reconnecting) && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {reconnecting ? 'Reconnecting to generation...' : 'Analyzing codebase and generating documentation...'}
          </div>
        )}

        {/* Documentation */}
        {docs && <DocumentationViewer content={docs} />}

        {/* Error message */}
        {error && (
          <p className="text-sm text-destructive text-center">{error}</p>
        )}
      </div>
    </div>
  )
}
