import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { AppHeader } from '@/components/AppHeader'
import { IndexingDialog } from '@/components/IndexingDialog'
import { getProject, type ProjectMetadata } from '@/lib/api'
import { Loader2, ExternalLink, ArrowLeft, BookOpen, Package, RefreshCw, RotateCw, Check, FileText, Zap, Users, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Tool {
  id: string
  name: string
  icon: LucideIcon
  description: string
  cacheKey: (owner: string, repo: string) => string
  route: (owner: string, repo: string) => string
}

const tools: Tool[] = [
  {
    id: 'wiki-brief',
    name: 'Quick Wiki',
    icon: Zap,
    description: 'Generate a brief wiki with overview and quickstart',
    cacheKey: (o, r) => `wiki_brief_${o}_${r}`,
    route: (o, r) => `/repo/${o}/${r}/wiki/brief`
  },
  {
    id: 'wiki-detailed',
    name: 'Full Wiki',
    icon: FileText,
    description: 'Generate comprehensive multi-page documentation',
    cacheKey: (o, r) => `wiki_detailed_${o}_${r}`,
    route: (o, r) => `/repo/${o}/${r}/wiki/detailed`
  },
  {
    id: 'product-docs',
    name: 'Product Docs',
    icon: Users,
    description: 'End-user focused documentation with features and workflows',
    cacheKey: (o, r) => `product_docs_${o}_${r}`,
    route: (o, r) => `/repo/${o}/${r}/product-docs`
  },
  {
    id: 'docs',
    name: 'Documentation (Legacy)',
    icon: BookOpen,
    description: 'Single-page technical documentation',
    cacheKey: (o, r) => `docs_${o}_${r}`,
    route: (o, r) => `/repo/${o}/${r}/documentation`
  },
  {
    id: 'package',
    name: 'Package Prompt',
    icon: Package,
    description: 'Migrate this SaaS to Electron',
    cacheKey: (o, r) => `package_prompt_${o}_${r}`,
    route: (o, r) => `/repo/${o}/${r}/package-prompt`
  },
  {
    id: 'reimplement',
    name: 'Reimplement',
    icon: RefreshCw,
    description: 'Rebuild with React/Vite/shadcn',
    cacheKey: (o, r) => `reimplement_prompt_${o}_${r}`,
    route: (o, r) => `/repo/${o}/${r}/reimplement-prompt`
  },
]

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default function RepoPage() {
  const { owner, repo } = useParams<{ owner: string; repo: string }>()
  const navigate = useNavigate()
  const [project, setProject] = useState<ProjectMetadata | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showReindexDialog, setShowReindexDialog] = useState(false)
  const [generatedTools, setGeneratedTools] = useState<Set<string>>(new Set())

  const checkGeneratedTools = () => {
    if (!owner || !repo) return
    const generated = new Set<string>()
    for (const tool of tools) {
      const cached = localStorage.getItem(tool.cacheKey(owner, repo))
      if (cached) {
        generated.add(tool.id)
      }
    }
    setGeneratedTools(generated)
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
    checkGeneratedTools()
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
    <div className="min-h-screen bg-background relative">
      <AppHeader title={`${owner}/${repo}`} />

      {/* Action Buttons */}
      <div className="max-w-4xl mx-auto px-6 pt-4 flex justify-end gap-2">
        {project?.url && (
          <a href={project.url} target="_blank" rel="noopener noreferrer">
            <Button variant="outline">
              <ExternalLink className="mr-2 h-4 w-4" />
              View on GitHub
            </Button>
          </a>
        )}
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

      <div className="max-w-4xl mx-auto p-6 space-y-8">
        {/* Repository Details Card */}
        {project && (
          <div>
            <h2 className="text-sm font-medium text-muted-foreground mb-3">Repository Details</h2>
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
                <span className="font-medium">Indexed</span>
              </div>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>{project.fileCount} files · {project.chunkCount} chunks · {project.embedding?.provider || 'unknown'}</p>
                <p>Last indexed {timeAgo(new Date(project.indexedAt))}</p>
              </div>
            </Card>
          </div>
        )}

        {/* Tools Grid */}
        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-3">Tools</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tools.map(tool => {
              const Icon = tool.icon
              const isGenerated = generatedTools.has(tool.id)
              return (
                <Card
                  key={tool.id}
                  className={cn(
                    "p-6 cursor-pointer hover:bg-muted/50 transition-colors",
                    !isGenerated && "opacity-60"
                  )}
                  onClick={() => navigate(tool.route(owner!, repo!))}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <Icon className="h-5 w-5" />
                    <span className="font-semibold">{tool.name}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    {tool.description}
                  </p>
                  {isGenerated && (
                    <div className="flex items-center gap-1 text-sm text-green-600">
                      <Check className="h-4 w-4" />
                      Generated
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
        </div>

        {/* Error message */}
        {error && (
          <p className="text-sm text-destructive text-center">{error}</p>
        )}
      </div>

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
