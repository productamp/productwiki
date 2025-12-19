import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Input } from '@/components/ui/input'
import { IndexingDialog } from '@/components/IndexingDialog'
import { type ProjectMetadata } from '@/lib/api'
import { ArrowUp } from 'lucide-react'

interface RepoConnectorProps {
  onIndexComplete?: () => void
}

export function RepoConnector({ onIndexComplete }: RepoConnectorProps) {
  const [url, setUrl] = useState('')
  const [showIndexingDialog, setShowIndexingDialog] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Re-focus input when dialog closes
  useEffect(() => {
    if (!showIndexingDialog) {
      inputRef.current?.focus()
    }
  }, [showIndexingDialog])

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
      <div className="w-full text-center space-y-8 py-12">
        <p className="text-2xl text-foreground font-medium">
          Which product do you want to document?
        </p>

        <form onSubmit={handleSubmit}>
          <div className="relative">
            <Input
              ref={inputRef}
              type="text"
              placeholder="https://github.com/owner/repo"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={showIndexingDialog}
              className="h-14 text-base pr-14 rounded-2xl bg-muted/50 border-0 focus-visible:ring-1"
            />
            <button
              type="submit"
              disabled={showIndexingDialog || !url.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-foreground text-background flex items-center justify-center hover:opacity-80 transition-opacity disabled:opacity-40"
            >
              <ArrowUp className="h-5 w-5" />
            </button>
          </div>
          {error && (
            <p className="text-sm text-destructive text-center mt-3">{error}</p>
          )}
        </form>
      </div>

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
