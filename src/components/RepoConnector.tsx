import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { indexRepo } from '@/lib/api'
import { Loader2, Github } from 'lucide-react'

interface RepoConnectorProps {
  onIndexComplete?: () => void
}

export function RepoConnector({ onIndexComplete }: RepoConnectorProps) {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!url.trim()) {
      setError('Please enter a GitHub URL')
      return
    }

    setLoading(true)
    setError('')

    try {
      const result = await indexRepo(url)

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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to index repository')
    } finally {
      setLoading(false)
    }
  }

  return (
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
            disabled={loading}
            className="h-12 text-base"
          />
          <Button type="submit" className="w-full h-12" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Indexing Repository...
              </>
            ) : (
              'Connect & Index'
            )}
          </Button>
          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}
        </form>
      </CardContent>
    </Card>
  )
}
