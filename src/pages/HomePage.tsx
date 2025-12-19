import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { RepoConnector } from '@/components/RepoConnector'
import { SettingsButton } from '@/components/Settings'
import { ErrorLog } from '@/components/ErrorLog'
import { getServerLogs, clearServerLogs } from '@/lib/api'
import { Hexagon } from 'lucide-react'

interface RepoHistoryItem {
  owner: string
  repo: string
  url: string
  indexedAt: string
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`

  return date.toLocaleDateString()
}

export default function HomePage() {
  const [history, setHistory] = useState<RepoHistoryItem[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const navigate = useNavigate()

  const loadHistory = () => {
    const stored = localStorage.getItem('repoHistory')
    if (stored) {
      try {
        setHistory(JSON.parse(stored))
      } catch {
        setHistory([])
      }
    }
  }

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

  useEffect(() => {
    loadHistory()
    loadErrors()

    // Poll for errors every 5 seconds
    const interval = setInterval(loadErrors, 5000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen bg-background relative">
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-2">
          <Hexagon className="h-5 w-5" />
          <span className="font-semibold">ProductQ</span>
        </div>
        <SettingsButton />
      </div>

      {/* Main Content */}
      <div className="flex flex-col items-center justify-center px-8 pt-24 pb-8">
        <div className="w-full max-w-md">
          <RepoConnector onIndexComplete={() => { loadHistory(); loadErrors(); }} />
        </div>

        {/* Recent Products */}
        {history.length > 0 && (
          <div className="w-full max-w-md mt-16">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-3">
              Recent
            </p>
            <div className="space-y-2">
              {history.slice(0, 5).map((item) => (
                <button
                  key={`${item.owner}/${item.repo}`}
                  onClick={() => navigate(`/repo/${item.owner}/${item.repo}`)}
                  className="w-full p-4 rounded-xl border bg-card hover:bg-muted/50 transition-colors text-left"
                >
                  <span className="font-medium">{item.owner}/{item.repo}</span>
                  <p className="text-sm text-muted-foreground mt-1">
                    Indexed {formatTimeAgo(item.indexedAt)}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {errors.length > 0 && (
        <div className="fixed bottom-4 right-4 w-96">
          <ErrorLog errors={errors} onClear={handleClearErrors} />
        </div>
      )}
    </div>
  )
}
