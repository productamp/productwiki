import { useMemo, useState, useEffect } from 'react'
import { MarkdownRenderer } from '@/components/MarkdownRenderer'
import { cn } from '@/lib/utils'
import { FileText, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface TocItem {
  id: string
  title: string
  level: number
}

interface DocumentationViewerProps {
  content: string
}

function extractHeadings(markdown: string): TocItem[] {
  const headings: TocItem[] = []
  const idCounts = new Map<string, number>()
  const lines = markdown.split('\n')

  for (const line of lines) {
    const match = line.match(/^(#{1,3})\s+(.+)$/)
    if (match) {
      const level = match[1].length
      const title = match[2].trim()
      // Create base ID from title (same as MarkdownRenderer does)
      const baseId = title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')

      // Handle duplicate IDs by adding suffix
      const count = idCounts.get(baseId) || 0
      idCounts.set(baseId, count + 1)
      const id = count === 0 ? baseId : `${baseId}-${count}`

      headings.push({ id, title, level })
    }
  }

  return headings
}

export function DocumentationViewer({ content }: DocumentationViewerProps) {
  const [activeId, setActiveId] = useState<string>('')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const headings = useMemo(() => extractHeadings(content), [content])

  // Track scroll position to highlight active heading
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id)
            break
          }
        }
      },
      { rootMargin: '-80px 0px -80% 0px' }
    )

    // Observe all heading elements
    headings.forEach(({ id }) => {
      const element = document.getElementById(id)
      if (element) observer.observe(element)
    })

    return () => observer.disconnect()
  }, [headings])

  const scrollToHeading = (id: string) => {
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setActiveId(id)
      setMobileMenuOpen(false)
    }
  }

  const TocNavItems = () => (
    <nav className="space-y-1">
      {headings.map((heading) => (
        <button
          key={heading.id}
          onClick={() => scrollToHeading(heading.id)}
          className={cn(
            "flex items-center gap-2 w-full text-left text-sm py-1.5 px-2 rounded transition-colors",
            heading.level === 1 && "font-medium",
            heading.level === 2 && "pl-4",
            heading.level === 3 && "pl-6 text-xs",
            activeId === heading.id
              ? "bg-muted text-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          )}
        >
          <FileText className="h-3 w-3 flex-shrink-0" />
          <span className="truncate">{heading.title}</span>
        </button>
      ))}
    </nav>
  )

  return (
    <div className="space-y-4">
      {/* Mobile TOC - collapsible dropdown */}
      {headings.length > 0 && (
        <div className="lg:hidden">
          <Button
            variant="outline"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="w-full justify-between"
          >
            <span className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Contents
            </span>
            {mobileMenuOpen ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
          {mobileMenuOpen && (
            <div className="mt-2 p-3 border rounded-lg bg-background max-h-64 overflow-y-auto">
              <TocNavItems />
            </div>
          )}
        </div>
      )}

      <div className="flex gap-6">
        {/* Desktop Sidebar TOC */}
        {headings.length > 0 && (
          <div className="hidden lg:block w-64 flex-shrink-0">
            <div className="sticky top-20">
              <div className="text-sm font-medium mb-3 text-muted-foreground">Contents</div>
              <TocNavItems />
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          <MarkdownRenderer content={content} />
        </div>
      </div>
    </div>
  )
}
