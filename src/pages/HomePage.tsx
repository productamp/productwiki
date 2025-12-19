import { useState, useEffect } from 'react'
import { RepoConnector } from '@/components/RepoConnector'
import { RepoHistory } from '@/components/RepoHistory'
import { SettingsButton } from '@/components/Settings'
import { ErrorLog } from '@/components/ErrorLog'
import { getServerLogs, clearServerLogs } from '@/lib/api'

interface RepoHistoryItem {
  owner: string
  repo: string
  url: string
  indexedAt: string
}

export default function HomePage() {
  const [history, setHistory] = useState<RepoHistoryItem[]>([])
  const [errors, setErrors] = useState<string[]>([])

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
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8 gap-12 relative">
      <SettingsButton />
      <RepoConnector onIndexComplete={() => { loadHistory(); loadErrors(); }} />
      <RepoHistory history={history} />
      {errors.length > 0 && (
        <div className="fixed bottom-4 right-4 w-96">
          <ErrorLog errors={errors} onClear={handleClearErrors} />
        </div>
      )}
    </div>
  )
}
