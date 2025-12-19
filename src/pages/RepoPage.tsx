import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ErrorLog } from '@/components/ErrorLog'
import { IndexingDialog } from '@/components/IndexingDialog'
import { getProject, getServerLogs, clearServerLogs, type ProjectMetadata } from '@/lib/api'
import { Loader2, FileText, Layers, Clock, ExternalLink, ArrowLeft, BookOpen, Package, RefreshCw, RotateCw } from 'lucide-react'

export default function RepoPage() {
  const { owner, repo } = useParams<{ owner: string; repo: string }>()
  const navigate = useNavigate()
  const [project, setProject] = useState<ProjectMetadata | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [errors, setErrors] = useState<string[]>([])
  const [showReindexDialog, setShowReindexDialog] = useState(false)

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

  const handleReindexComplete = (result: ProjectMetadata) => {
    setShowReindexDialog(false)
    setProject(result)
  }

  const handleReindexCancel = () => {
    setShowReindexDialog(false)
  }

  const handleReindexError = (errorMessage: string) => {
    setShowReindexDialog(false)
    setError(errorMessage)
    loadErrors()
  }

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

    // Poll for errors every 5 seconds
    const interval = setInterval(loadErrors, 5000)
    return () => clearInterval(interval)
  }, [owner, repo])

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
        <Link to="/">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
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
          <Link to="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">
              {owner}/{repo}
            </h1>
            {project?.url && (
              <a
                href={project.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-muted-foreground hover:underline flex items-center gap-1"
              >
                View on GitHub
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
          {project?.url && (
            <Button
              variant="outline"
              onClick={() => setShowReindexDialog(true)}
              disabled={showReindexDialog}
            >
              <RotateCw className="mr-2 h-4 w-4" />
              Re-index
            </Button>
          )}
        </div>

        {/* Stats */}
        {project && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1">
                  <FileText className="h-4 w-4" />
                  Files Indexed
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CardTitle>{project.fileCount}</CardTitle>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1">
                  <Layers className="h-4 w-4" />
                  Chunks Created
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CardTitle>{project.chunkCount}</CardTitle>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  Last Indexed
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CardTitle className="text-lg">
                  {new Date(project.indexedAt).toLocaleString()}
                </CardTitle>
                {project.embedding && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Provider: {project.embedding.provider}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Documentation
              </CardTitle>
              <CardDescription>
                Generate comprehensive technical documentation for this codebase
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => navigate(`/repo/${owner}/${repo}/documentation`)}
                className="w-full"
              >
                Generate Docs
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Package Prompt
              </CardTitle>
              <CardDescription>
                Generate a Claude Code prompt to migrate this SaaS to Electron
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => navigate(`/repo/${owner}/${repo}/package-prompt`)}
                variant="outline"
                className="w-full"
              >
                Generate Prompt
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5" />
                Reimplement Prompt
              </CardTitle>
              <CardDescription>
                Generate a Claude Code prompt to rebuild with React/Vite/shadcn
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => navigate(`/repo/${owner}/${repo}/reimplement-prompt`)}
                variant="outline"
                className="w-full"
              >
                Generate Prompt
              </Button>
            </CardContent>
          </Card>
        </div>

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

      {/* Re-index Dialog */}
      {project?.url && (
        <IndexingDialog
          open={showReindexDialog}
          url={project.url}
          onComplete={handleReindexComplete}
          onCancel={handleReindexCancel}
          onError={handleReindexError}
        />
      )}
    </div>
  )
}
