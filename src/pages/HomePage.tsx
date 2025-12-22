import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { RepoConnector } from '@/components/RepoConnector'
import { AppHeader } from '@/components/AppHeader'
import { getProjects, type ProjectMetadata } from '@/lib/api'

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
  const [allProjects, setAllProjects] = useState<ProjectMetadata[]>([])
  const [loading, setLoading] = useState(true)
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

  const loadAllProjects = async () => {
    try {
      setLoading(true)
      const projects = await getProjects()
      setAllProjects(projects)
    } catch (error) {
      console.error('Failed to load projects:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadHistory()
    loadAllProjects()
  }, [])

  return (
    <div className="min-h-screen bg-background relative">
      <AppHeader />

      {/* Main Content */}
      <div className="flex flex-col items-center justify-center px-8 pt-24 pb-8">
        <div className="w-full max-w-md">
          <RepoConnector onIndexComplete={() => {
            loadHistory()
            loadAllProjects()
          }} />
        </div>

        {/* Recent Products */}
        {history.length > 0 && (
          <div className="w-full max-w-md mt-16">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-3">
              Your Recent
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

        {/* All Available Repositories */}
        {allProjects.length > 0 && (
          <div className="w-full max-w-md mt-16">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-3">
              All Available Repositories
            </p>
            {loading ? (
              <div className="text-center text-muted-foreground py-8">
                Loading repositories...
              </div>
            ) : (
              <div className="space-y-2">
                {allProjects.map((project) => (
                  <button
                    key={`${project.owner}/${project.repo}`}
                    onClick={() => navigate(`/repo/${project.owner}/${project.repo}`)}
                    className="w-full p-4 rounded-xl border bg-card hover:bg-muted/50 transition-colors text-left"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <span className="font-medium">{project.owner}/{project.repo}</span>
                        <p className="text-sm text-muted-foreground mt-1">
                          {project.chunkCount.toLocaleString()} chunks • Indexed {formatTimeAgo(project.indexedAt)}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
