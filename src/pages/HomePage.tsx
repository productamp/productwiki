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

        {/* All Repositories */}
        {allProjects.length > 0 && (
          <div className="w-full max-w-md mt-16">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-3">
              All Repositories
            </p>
            {loading ? (
              <div className="text-center text-muted-foreground py-8">
                Loading repositories...
              </div>
            ) : (
              <div className="space-y-2">
                {allProjects.map((project) => {
                  const isRecent = history.some(
                    (h) => h.owner === project.owner && h.repo === project.repo
                  )

                  return (
                    <button
                      key={`${project.owner}/${project.repo}`}
                      onClick={() => navigate(`/repo/${project.owner}/${project.repo}`)}
                      className="w-full p-4 rounded-xl border bg-card hover:bg-muted/50 transition-colors text-left"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{project.owner}/{project.repo}</span>
                            {isRecent && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                                Recently Used
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {project.chunkCount.toLocaleString()} chunks • Indexed {formatTimeAgo(project.indexedAt)}
                          </p>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
