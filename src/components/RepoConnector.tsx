import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { IndexingDialog } from '@/components/IndexingDialog'
import { type ProjectMetadata } from '@/lib/api'
import { Github } from 'lucide-react'

interface RepoConnectorProps {
  onIndexComplete?: () => void
}

export function RepoConnector({ onIndexComplete }: RepoConnectorProps) {
  const [url, setUrl] = useState('')
  const [showIndexingDialog, setShowIndexingDialog] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!url.trim()) {
      setError('Please enter a GitHub URL')
      return
    }

    setError('')
    setShowIndexingDialog(true)
  }

  const handleIndexComplete = (result: ProjectMetadata) => {
    setShowIndexingDialog(false)

    // Update localStorage history
    const history = JSON.parse(localStorage.getItem('repoHistory') || '[]')
    const existing = history.findIndex(
      (item: { owner: string; repo: string }) =>
        item.owner === result.owner && item.repo === result.repo
    )
    if (existing >= 0) {
      history.splice(existing, 1)
    }
    history.unshift({
      owner: result.owner,
      repo: result.repo,
      url: result.url,
      indexedAt: result.indexedAt,
    })
    localStorage.setItem('repoHistory', JSON.stringify(history.slice(0, 20)))

    onIndexComplete?.()
    navigate(`/repo/${result.owner}/${result.repo}`)
  }

  const handleIndexCancel = () => {
    setShowIndexingDialog(false)
  }

  const handleIndexError = (errorMessage: string) => {
    setShowIndexingDialog(false)
    setError(errorMessage)
  }

  return (
    <>
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2 text-3xl">
            <Github className="h-8 w-8" />
            DeepWiki
          </CardTitle>
          <CardDescription>
            RAG-powered codebase documentation generator
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="text"
              placeholder="https://github.com/owner/repo"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={showIndexingDialog}
              className="h-12 text-base"
            />
            <Button type="submit" className="w-full h-12" disabled={showIndexingDialog}>
              Connect & Index
            </Button>
            {error && (
              <p className="text-sm text-destructive text-center">{error}</p>
            )}
          </form>
        </CardContent>
      </Card>

      <IndexingDialog
        open={showIndexingDialog}
        url={url}
        onComplete={handleIndexComplete}
        onCancel={handleIndexCancel}
        onError={handleIndexError}
      />
    </>
  )
}
