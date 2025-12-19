import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, ChevronRight, X, ExternalLink } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface ErrorLogProps {
  errors: string[]
  onClear: () => void
}

/**
 * Extract a human-readable summary from an error message
 */
function getErrorSummary(error: string): string {
  // Extract common error patterns
  if (error.includes('429 Too Many Requests')) {
    return 'Rate limit exceeded - too many requests'
  }
  if (error.includes('401') || error.includes('Unauthorized')) {
    return 'Authentication failed - check API key'
  }
  if (error.includes('403') || error.includes('Forbidden')) {
    return 'Access denied - check permissions'
  }
  if (error.includes('404') || error.includes('Not Found')) {
    return 'Resource not found'
  }
  if (error.includes('500') || error.includes('Internal Server Error')) {
    return 'Server error - please retry'
  }
  if (error.includes('ECONNREFUSED') || error.includes('ENOTFOUND')) {
    return 'Connection failed - check network'
  }
  if (error.includes('timeout') || error.includes('ETIMEDOUT')) {
    return 'Request timed out'
  }
  if (error.includes('GoogleGenerativeAI Error')) {
    // Extract the specific Google error
    const match = error.match(/\[(\d{3})[^\]]*\]/)
    if (match) {
      const code = match[1]
      if (code === '429') return 'Gemini rate limit exceeded'
      if (code === '401') return 'Invalid Gemini API key'
      if (code === '403') return 'Gemini access denied'
    }
    return 'Gemini API error'
  }
  if (error.includes('LLM streaming error')) {
    return 'LLM generation failed'
  }
  if (error.includes('embedding') || error.includes('Embedding')) {
    return 'Embedding generation failed'
  }

  // Fallback: try to extract first meaningful part
  const parts = error.split(':')
  if (parts.length > 1) {
    // Try to get the error type
    const errorType = parts.find(
      (p) => p.toLowerCase().includes('error') || p.toLowerCase().includes('failed')
    )
    if (errorType) {
      return errorType.trim().slice(0, 50)
    }
  }

  // Last resort: truncate the message
  return error.slice(0, 50) + (error.length > 50 ? '...' : '')
}

/**
 * Get the timestamp from an error if it has one
 */
function getErrorTimestamp(error: string): string | null {
  const match = error.match(/\[(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)\]/)
  if (match) {
    try {
      const date = new Date(match[1])
      return date.toLocaleTimeString()
    } catch {
      return null
    }
  }
  return null
}

export function ErrorLog({ errors, onClear }: ErrorLogProps) {
  const [isOpen, setIsOpen] = useState(false)

  if (errors.length === 0) return null

  // Get the most recent error for the summary
  const latestError = errors[errors.length - 1]
  const summary = getErrorSummary(latestError)
  const errorCount = errors.length

  return (
    <>
      <Card className="border-destructive/50 bg-destructive/5 shadow-lg">
        <CardHeader className="py-3 px-4">
          <CardTitle className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{summary}</span>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setIsOpen(true)}
              >
                {errorCount > 1 && `+${errorCount - 1} more`}
                <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClear}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
      </Card>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Server Errors ({errorCount})
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4 space-y-3 max-h-[60vh] overflow-y-auto">
            {[...errors].reverse().map((error, index) => {
              const timestamp = getErrorTimestamp(error)
              const errorSummary = getErrorSummary(error)
              return (
                <div key={index} className="border rounded-lg p-3 bg-muted/30">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="text-sm font-medium text-destructive">{errorSummary}</span>
                    {timestamp && (
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        {timestamp}
                      </span>
                    )}
                  </div>
                  <details className="group">
                    <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground flex items-center gap-1">
                      <ExternalLink className="h-3 w-3" />
                      View full error
                    </summary>
                    <pre className="mt-2 text-xs font-mono p-2 bg-background rounded border text-destructive overflow-x-auto whitespace-pre-wrap break-all">
                      {error}
                    </pre>
                  </details>
                </div>
              )
            })}
          </div>
          <div className="flex justify-end mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onClear()
                setIsOpen(false)
              }}
            >
              Clear All Errors
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
