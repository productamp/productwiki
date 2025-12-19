import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { DocumentationViewer } from '@/components/DocumentationViewer'
import { ErrorLog } from '@/components/ErrorLog'
import { getProject, generateDocs, getServerLogs, clearServerLogs, type ProjectMetadata } from '@/lib/api'
import { Loader2, ArrowLeft, BookOpen, Copy, Check, AlertTriangle, RotateCw } from 'lucide-react'

export default function DocumentationPage() {
  const { owner, repo } = useParams<{ owner: string; repo: string }>()
  const [project, setProject] = useState<ProjectMetadata | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [docs, setDocs] = useState('')
  const [generating, setGenerating] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [copied, setCopied] = useState(false)

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
    loadErrors()

    const interval = setInterval(loadErrors, 5000)
    return () => clearInterval(interval)
  }, [owner, repo])

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
      loadErrors()
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
    <div className="min-h-screen bg-background p-8 relative">
            <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link to={`/repo/${owner}/${repo}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BookOpen className="h-6 w-6" />
              Technical Documentation
            </h1>
            <p className="text-sm text-muted-foreground">
              {owner}/{repo}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {docs && !generating && (
              <Button onClick={handleGenerate} variant="outline" size="icon" title="Regenerate">
                <RotateCw className="h-4 w-4" />
              </Button>
            )}
            {docs && (
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

        {/* Description */}
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              Comprehensive technical documentation generated from the codebase analysis.
              Includes architecture overview, key components, data flow, and API reference.
            </p>
          </CardContent>
        </Card>

        {/* Status */}
        {generating && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Analyzing codebase and generating documentation...
          </div>
        )}

        {/* Documentation */}
        {docs && <DocumentationViewer content={docs} />}

        {/* Error message */}
        {error && (
          <p className="text-sm text-destructive text-center">{error}</p>
        )}
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
