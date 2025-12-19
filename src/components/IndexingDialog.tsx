import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Check, Loader2, Circle, X } from 'lucide-react'
import { indexRepoStream, type IndexProgress, type ProjectMetadata } from '@/lib/api'

interface IndexingDialogProps {
  open: boolean
  url: string
  onComplete: (metadata: ProjectMetadata) => void
  onCancel: () => void
  onError: (error: string) => void
}

type StepStatus = 'pending' | 'active' | 'completed'

interface Step {
  id: string
  label: string
  status: StepStatus
  detail?: string
}

export function IndexingDialog({
  open,
  url,
  onComplete,
  onCancel,
  onError,
}: IndexingDialogProps) {
  const [steps, setSteps] = useState<Step[]>([
    { id: 'clone', label: 'Cloning repository', status: 'pending' },
    { id: 'extract', label: 'Extracting files', status: 'pending' },
    { id: 'chunk', label: 'Chunking documents', status: 'pending' },
    { id: 'embed', label: 'Embedding chunks', status: 'pending' },
    { id: 'store', label: 'Storing in database', status: 'pending' },
  ])
  const [embedProgress, setEmbedProgress] = useState({ current: 0, total: 0 })
  const [elapsedTime, setElapsedTime] = useState(0)
  const [isCancelling, setIsCancelling] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)
  const startTimeRef = useRef<number>(Date.now())

  // Parse owner/repo from URL for display
  const getRepoName = (url: string) => {
    const match = url.match(/github\.com\/([^/]+\/[^/]+)/)
    return match ? match[1] : url
  }

  useEffect(() => {
    if (!open) return

    // Reset state
    setSteps([
      { id: 'clone', label: 'Cloning repository', status: 'pending' },
      { id: 'extract', label: 'Extracting files', status: 'pending' },
      { id: 'chunk', label: 'Chunking documents', status: 'pending' },
      { id: 'embed', label: 'Embedding chunks', status: 'pending' },
      { id: 'store', label: 'Storing in database', status: 'pending' },
    ])
    setEmbedProgress({ current: 0, total: 0 })
    setElapsedTime(0)
    setIsCancelling(false)
    startTimeRef.current = Date.now()

    // Start timer
    const timer = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTimeRef.current) / 1000))
    }, 100)

    // Start indexing
    abortControllerRef.current = new AbortController()
    const runIndexing = async () => {
      try {
        const generator = indexRepoStream(url, abortControllerRef.current?.signal)

        for await (const event of generator) {
          handleProgressEvent(event)
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          // User cancelled - handled in handleCancel
        } else {
          onError(err instanceof Error ? err.message : 'Failed to index repository')
        }
      }
    }

    runIndexing()

    return () => {
      clearInterval(timer)
      abortControllerRef.current?.abort()
    }
  }, [open, url])

  const handleProgressEvent = (event: IndexProgress) => {
    switch (event.phase) {
      case 'clone':
        if (event.status === 'started') {
          updateStep('clone', 'active')
        } else if (event.status === 'completed') {
          updateStep('clone', 'completed')
          updateStep('extract', 'active')
        }
        break

      case 'extract':
        updateStep('extract', 'completed', `${event.fileCount} files`)
        updateStep('chunk', 'active')
        break

      case 'chunk':
        updateStep('chunk', 'completed', `${event.chunkCount} chunks`)
        updateStep('embed', 'active')
        break

      case 'embed':
        if (event.status === 'progress') {
          setEmbedProgress({ current: event.current, total: event.total })
        } else if (event.status === 'completed') {
          updateStep('embed', 'completed')
          updateStep('store', 'active')
        }
        break

      case 'store':
        if (event.status === 'completed') {
          updateStep('store', 'completed')
        }
        break

      case 'complete':
        onComplete(event.metadata)
        break

      case 'error':
        onError(event.error)
        break

      case 'cancelled':
        onCancel()
        break
    }
  }

  const updateStep = (id: string, status: StepStatus, detail?: string) => {
    setSteps((prev) =>
      prev.map((step) =>
        step.id === id ? { ...step, status, detail: detail ?? step.detail } : step
      )
    )
  }

  const handleCancel = () => {
    setIsCancelling(true)
    abortControllerRef.current?.abort()
    onCancel()
  }

  const formatTime = (seconds: number) => {
    if (seconds < 60) {
      return `${seconds}s`
    }
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}m ${secs}s`
  }

  const renderStepIcon = (status: StepStatus) => {
    switch (status) {
      case 'completed':
        return <Check className="h-4 w-4 text-green-500" />
      case 'active':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
      case 'pending':
        return <Circle className="h-4 w-4 text-muted-foreground" />
    }
  }

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Indexing Repository</DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              disabled={isCancelling}
            >
              {isCancelling ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <X className="h-4 w-4" />
              )}
              <span className="ml-1">{isCancelling ? 'Cancelling...' : 'Cancel'}</span>
            </Button>
          </div>
          <p className="text-sm text-muted-foreground font-mono">
            {getRepoName(url)}
          </p>
        </DialogHeader>

        <div className="space-y-3 mt-4">
          {steps.map((step) => (
            <div key={step.id} className="flex items-center gap-3">
              {renderStepIcon(step.status)}
              <span
                className={
                  step.status === 'pending'
                    ? 'text-muted-foreground'
                    : step.status === 'active'
                    ? 'text-foreground'
                    : 'text-foreground'
                }
              >
                {step.label}
                {step.detail && (
                  <span className="text-muted-foreground ml-1">({step.detail})</span>
                )}
              </span>
            </div>
          ))}

          {/* Embedding progress bar */}
          {steps.find((s) => s.id === 'embed')?.status === 'active' && embedProgress.total > 0 && (
            <div className="ml-7 space-y-1">
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-300"
                  style={{
                    width: `${Math.round((embedProgress.current / embedProgress.total) * 100)}%`,
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {embedProgress.current}/{embedProgress.total} (
                {Math.round((embedProgress.current / embedProgress.total) * 100)}%)
              </p>
            </div>
          )}
        </div>

        <div className="mt-4 text-sm text-muted-foreground">
          Elapsed: {formatTime(elapsedTime)}
        </div>
      </DialogContent>
    </Dialog>
  )
}
