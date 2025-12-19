import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Github, Clock } from 'lucide-react'

interface RepoHistoryItem {
  owner: string
  repo: string
  url: string
  indexedAt: string
}

interface RepoHistoryProps {
  history: RepoHistoryItem[]
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`

  return date.toLocaleDateString()
}

export function RepoHistory({ history }: RepoHistoryProps) {
  const navigate = useNavigate()

  if (history.length === 0) {
    return null
  }

  return (
    <div className="w-full max-w-4xl">
      <h2 className="text-xl font-semibold mb-4 text-muted-foreground">
        Previously Indexed
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {history.map((item) => (
          <Card
            key={`${item.owner}/${item.repo}`}
            className="cursor-pointer hover:bg-accent transition-colors"
            onClick={() => navigate(`/repo/${item.owner}/${item.repo}`)}
          >
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Github className="h-5 w-5" />
                {item.owner}/{item.repo}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDate(item.indexedAt)}
              </CardDescription>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
