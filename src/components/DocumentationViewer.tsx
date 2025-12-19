import ReactMarkdown from 'react-markdown'
import { Card, CardContent } from '@/components/ui/card'

interface DocumentationViewerProps {
  content: string
}

export function DocumentationViewer({ content }: DocumentationViewerProps) {
  return (
    <Card className="w-full">
      <CardContent className="pt-6">
        <div className="prose dark:prose-invert max-w-none">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
      </CardContent>
    </Card>
  )
}
