import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import mermaid from 'mermaid'

interface MarkdownRendererProps {
  content: string
  className?: string
}

interface MermaidDiagramProps {
  code: string
}

function MermaidDiagram({ code }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [svg, setSvg] = useState<string>('')
  const [error, setError] = useState<string>('')
  const idRef = useRef(`mermaid-${Math.random().toString(36).substr(2, 9)}`)

  useEffect(() => {
    async function render() {
      if (!containerRef.current) return

      try {
        // Detect dark mode
        const isDark = document.documentElement.classList.contains('dark')

        // Re-initialize mermaid with current theme
        mermaid.initialize({
          startOnLoad: false,
          theme: isDark ? 'dark' : 'default',
          securityLevel: 'loose',
          fontFamily: 'inherit',
        })

        // Check if the diagram is valid
        const isValid = await mermaid.parse(code)
        if (!isValid) {
          setError('Invalid mermaid syntax')
          return
        }

        const { svg } = await mermaid.render(idRef.current, code)
        setSvg(svg)
        setError('')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to render diagram')
      }
    }

    render()
  }, [code])

  if (error) {
    return (
      <div className="my-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
        <p className="text-sm text-destructive mb-2">Failed to render Mermaid diagram:</p>
        <pre className="text-xs text-muted-foreground overflow-x-auto">{code}</pre>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="my-4 flex justify-center overflow-x-auto"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

function createHeadingIdGenerator() {
  const idCounts = new Map<string, number>()

  return function generateHeadingId(text: string): string {
    const baseId = text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')

    const count = idCounts.get(baseId) || 0
    idCounts.set(baseId, count + 1)
    return count === 0 ? baseId : `${baseId}-${count}`
  }
}

export function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  // Create a new ID generator for each render to handle duplicate headings
  const generateHeadingId = createHeadingIdGenerator()

  return (
    <div className={`prose dark:prose-invert max-w-none ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1({ children }) {
            const text = String(children)
            const id = generateHeadingId(text)
            return <h1 id={id}>{children}</h1>
          },
          h2({ children }) {
            const text = String(children)
            const id = generateHeadingId(text)
            return <h2 id={id}>{children}</h2>
          },
          h3({ children }) {
            const text = String(children)
            const id = generateHeadingId(text)
            return <h3 id={id}>{children}</h3>
          },
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '')
            const language = match?.[1]
            const codeContent = String(children).replace(/\n$/, '')

            // Check if it's a mermaid code block
            if (language === 'mermaid') {
              return <MermaidDiagram code={codeContent} />
            }

            // For inline code or other languages, render normally
            const isInline = !className
            if (isInline) {
              return <code {...props}>{children}</code>
            }

            return (
              <code className={className} {...props}>
                {children}
              </code>
            )
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
