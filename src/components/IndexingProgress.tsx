import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'

interface IndexingProgressProps {
  repoUrl: string
}

export function IndexingProgress({ repoUrl }: IndexingProgressProps) {
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          Indexing Repository
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">
          {repoUrl}
        </p>
        <div className="space-y-2 text-sm">
          <p>Cloning repository...</p>
          <p>Reading files...</p>
          <p>Generating embeddings...</p>
          <p>Storing in vector database...</p>
        </div>
      </CardContent>
    </Card>
  )
}
