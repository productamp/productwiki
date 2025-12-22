import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { DocumentationViewer } from '@/components/DocumentationViewer'
import { AppHeader } from '@/components/AppHeader'
import { getProject, generatePackagePrompt, JobIds, type ProjectMetadata } from '@/lib/api'
import { useSimpleJobReconnection } from '@/hooks/useJobReconnection'
import { Loader2, Copy, Check, RotateCw } from 'lucide-react'

export default function PackagePromptPage() {
  const { owner, repo } = useParams<{ owner: string; repo: string }>()
  const [project, setProject] = useState<ProjectMetadata | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [prompt, setPrompt] = useState('')
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(prompt)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  useEffect(() => {
    async function loadProject() {
      if (!owner || !repo) return

      try {
        // Check localStorage for cached prompt
        const cachedPrompt = localStorage.getItem(`package_prompt_${owner}_${repo}`)
        if (cachedPrompt) {
          setPrompt(cachedPrompt)
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
    jobId: owner && repo ? JobIds.packagePrompt(owner, repo) : '',
    generator: () => generatePackagePrompt(owner!, repo!),
    onContent: setPrompt,
    cacheKey: `package_prompt_${owner}_${repo}`,
    enabled: !loading && !!owner && !!repo,
  })

  const handleGenerate = async () => {
    if (!owner || !repo) return

    setGenerating(true)
    setPrompt('')
    setError('')

    try {
      let fullContent = ''

      for await (const chunk of generatePackagePrompt(owner, repo)) {
        fullContent += chunk
        setPrompt(fullContent)
      }

      localStorage.setItem(`package_prompt_${owner}_${repo}`, fullContent)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate prompt')
    } finally {
      setGenerating(false)
    }
  }

  // Auto-generate on mount if no cached prompt
  useEffect(() => {
    if (!loading && project && !prompt && !generating) {
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
        subtitle="Package Prompt"
        actions={
          <>
            {prompt && !generating && (
              <Button onClick={handleGenerate} variant="outline" size="icon" title="Regenerate">
                <RotateCw className="h-4 w-4" />
              </Button>
            )}
            {prompt && (
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
        {/* Description */}
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              This generates a one-shot prompt for Claude Code to migrate this SaaS codebase to an Electron desktop application.
              The prompt focuses on what needs to be done and how, without unnecessary code snippets.
              Copy the generated prompt and paste it into Claude Code with the repository open.
            </p>
          </CardContent>
        </Card>

        {/* Status */}
        {(generating || reconnecting) && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {reconnecting ? 'Reconnecting to generation...' : 'Analyzing codebase and generating migration prompt...'}
          </div>
        )}

        {/* Generated Prompt */}
        {prompt && <DocumentationViewer content={prompt} />}

        {/* Error message */}
        {error && (
          <p className="text-sm text-destructive text-center">{error}</p>
        )}
      </div>
    </div>
  )
}
