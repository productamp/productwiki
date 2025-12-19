import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, ChevronDown, ChevronUp, X } from 'lucide-react'

interface ErrorLogProps {
  errors: string[]
  onClear: () => void
}

export function ErrorLog({ errors, onClear }: ErrorLogProps) {
  const [expanded, setExpanded] = useState(true)

  if (errors.length === 0) return null

  return (
    <Card className="border-destructive/50 bg-destructive/5">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-4 w-4" />
            Server Errors ({errors.length})
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={onClear}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      {expanded && (
        <CardContent>
          <div className="max-h-48 overflow-y-auto space-y-2">
            {errors.map((error, index) => (
              <div
                key={index}
                className="text-xs font-mono p-2 bg-background rounded border text-destructive"
              >
                {error}
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  )
}
