import { Card, CardContent } from '@/components/ui/card'
import { MarkdownRenderer } from '@/components/MarkdownRenderer'

interface DocumentationViewerProps {
  content: string
}

export function DocumentationViewer({ content }: DocumentationViewerProps) {
  return (
    <Card className="w-full">
      <CardContent className="pt-6">
        <MarkdownRenderer content={content} />
      </CardContent>
    </Card>
  )
}
