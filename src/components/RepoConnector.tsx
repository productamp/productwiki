import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { IndexingDialog, type IndexingMode } from '@/components/IndexingDialog'
import { FileSelectionDialog } from '@/components/FileSelectionDialog'
import { type ProjectMetadata, type LocalFileData } from '@/lib/api'
import { processLocalFiles, getRootDirectoryName, type ProcessingResult } from '@/lib/fileProcessor'
import { ArrowUp, Github, FolderOpen, Loader2 } from 'lucide-react'

interface RepoConnectorProps {
  onIndexComplete?: () => void
}

export function RepoConnector({ onIndexComplete }: RepoConnectorProps) {
  const [mode, setMode] = useState<IndexingMode>('github')
  const [url, setUrl] = useState('')
  const [projectName, setProjectName] = useState('')
  const [localFiles, setLocalFiles] = useState<LocalFileData[]>([])
  const [processingResult, setProcessingResult] = useState<ProcessingResult | null>(null)
  const [isProcessingFiles, setIsProcessingFiles] = useState(false)
  const [showFileSelectionDialog, setShowFileSelectionDialog] = useState(false)
  const [showIndexingDialog, setShowIndexingDialog] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const directoryInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Re-focus input when dialogs close
  useEffect(() => {
    if (!showIndexingDialog && !showFileSelectionDialog) {
      inputRef.current?.focus()
    }
  }, [showIndexingDialog, showFileSelectionDialog])

  // Reset state when mode changes
  useEffect(() => {
    setError('')
    setUrl('')
    setProjectName('')
    setLocalFiles([])
    setProcessingResult(null)
  }, [mode])

  const handleDirectorySelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setError('')
    setIsProcessingFiles(true)
    setProcessingResult(null)

    try {
      const result = await processLocalFiles(files)
      setLocalFiles(result.files)
      setProcessingResult(result)

      // Auto-set project name from directory name
      const dirName = getRootDirectoryName(files)
      if (dirName) {
        setProjectName(dirName)
      }

      // Show the file selection dialog with breakdown
      setShowFileSelectionDialog(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process directory')
      setLocalFiles([])
      setProcessingResult(null)
    } finally {
      setIsProcessingFiles(false)
    }
  }

  const handleFileSelectionConfirm = () => {
    setShowFileSelectionDialog(false)
    if (localFiles.length > 0 && projectName.trim()) {
      setShowIndexingDialog(true)
    }
  }

  const handleFileSelectionCancel = () => {
    setShowFileSelectionDialog(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (mode === 'github') {
      if (!url.trim()) {
        setError('Please enter a GitHub URL')
        return
      }
      setError('')
      setShowIndexingDialog(true)
    } else {
      // For local mode, clicking submit re-opens file selection if we have files
      if (processingResult && localFiles.length > 0) {
        setShowFileSelectionDialog(true)
      } else {
        setError('Please select a directory first')
      }
    }
  }

  const handleIndexComplete = (result: ProjectMetadata) => {
    setShowIndexingDialog(false)

    // Update localStorage history
    const history = JSON.parse(localStorage.getItem('repoHistory') || '[]')
    const existing = history.findIndex(
      (item: { owner: string; repo: string }) =>
        item.owner === result.owner && item.repo === result.repo
    )
    if (existing >= 0) {
      history.splice(existing, 1)
    }
    history.unshift({
      owner: result.owner,
      repo: result.repo,
      url: result.url,
      indexedAt: result.indexedAt,
    })
    localStorage.setItem('repoHistory', JSON.stringify(history.slice(0, 20)))

    onIndexComplete?.()
    navigate(`/repo/${result.owner}/${result.repo}`)
  }

  const handleIndexCancel = () => {
    setShowIndexingDialog(false)
  }

  const handleIndexError = (errorMessage: string) => {
    setShowIndexingDialog(false)
    setError(errorMessage)
  }

  return (
    <>
      <div className="w-full text-center space-y-8 py-12">
        <p className="text-2xl text-foreground font-medium">
          Which product do you want to document?
        </p>

        {/* Mode Toggle */}
        <div className="flex justify-center">
          <div className="inline-flex rounded-lg bg-muted p-1">
            <button
              type="button"
              onClick={() => setMode('github')}
              className={`px-4 py-2 text-sm rounded-md transition-colors flex items-center gap-2 ${
                mode === 'github'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Github className="h-4 w-4" />
              GitHub URL
            </button>
            <button
              type="button"
              onClick={() => setMode('local')}
              className={`px-4 py-2 text-sm rounded-md transition-colors flex items-center gap-2 ${
                mode === 'local'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <FolderOpen className="h-4 w-4" />
              Local Directory
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {mode === 'github' ? (
            <div className="relative">
              <Input
                ref={inputRef}
                type="text"
                placeholder="https://github.com/owner/repo"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={showIndexingDialog}
                className="h-14 text-base pr-14 rounded-2xl bg-muted/50 border-0 focus-visible:ring-1"
              />
              <button
                type="submit"
                disabled={showIndexingDialog || !url.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-foreground text-background flex items-center justify-center hover:opacity-80 transition-opacity disabled:opacity-40"
              >
                <ArrowUp className="h-5 w-5" />
              </button>
            </div>
          ) : (
            <div className="space-y-4 max-w-md mx-auto">
              <input
                ref={directoryInputRef}
                type="file"
                // @ts-expect-error webkitdirectory is non-standard but widely supported
                webkitdirectory=""
                directory=""
                multiple
                className="hidden"
                onChange={handleDirectorySelect}
              />

              <Button
                type="button"
                variant="outline"
                onClick={() => directoryInputRef.current?.click()}
                disabled={showIndexingDialog || showFileSelectionDialog || isProcessingFiles}
                className="w-full h-14 text-base"
              >
                {isProcessingFiles ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Scanning directory...
                  </>
                ) : processingResult ? (
                  <>
                    <FolderOpen className="mr-2 h-5 w-5" />
                    {projectName} ({localFiles.length} files)
                  </>
                ) : (
                  <>
                    <FolderOpen className="mr-2 h-5 w-5" />
                    Select Directory
                  </>
                )}
              </Button>

              {processingResult && localFiles.length > 0 && (
                <Button
                  type="submit"
                  disabled={showIndexingDialog || showFileSelectionDialog}
                  className="w-full h-12"
                >
                  <ArrowUp className="mr-2 h-5 w-5" />
                  Index {localFiles.length} Files
                </Button>
              )}
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive text-center mt-3">
              {error}
            </p>
          )}
        </form>
      </div>

      {/* File Selection Dialog - shows breakdown before indexing */}
      {processingResult && (
        <FileSelectionDialog
          open={showFileSelectionDialog}
          projectName={projectName}
          result={processingResult}
          onConfirm={handleFileSelectionConfirm}
          onCancel={handleFileSelectionCancel}
        />
      )}

      {/* Indexing Dialog - shows progress during indexing */}
      <IndexingDialog
        open={showIndexingDialog}
        mode={mode}
        url={url}
        projectName={projectName}
        localFiles={localFiles}
        onComplete={handleIndexComplete}
        onCancel={handleIndexCancel}
        onError={handleIndexError}
      />
    </>
  )
}
