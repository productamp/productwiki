import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { FolderOpen, FileCode, FolderX, FileX, ArrowRight } from 'lucide-react'
import { type ProcessingResult } from '@/lib/fileProcessor'

interface FileSelectionDialogProps {
  open: boolean
  projectName: string
  result: ProcessingResult
  onConfirm: () => void
  onCancel: () => void
}

export function FileSelectionDialog({
  open,
  projectName,
  result,
  onConfirm,
  onCancel,
}: FileSelectionDialogProps) {
  const { totalFiles, files, skippedReasons } = result
  const excludedTotal = totalFiles - files.length

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5" />
            {projectName}
          </DialogTitle>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="space-y-1">
              <div className="text-2xl font-bold">{totalFiles.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">Total Files</div>
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold text-muted-foreground">{excludedTotal.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">Excluded</div>
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold text-green-600">{files.length.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">Ready to Index</div>
            </div>
          </div>

          {/* Breakdown */}
          {excludedTotal > 0 && (
            <div className="bg-muted/50 rounded-lg p-3 space-y-2">
              <div className="text-sm font-medium">Excluded files breakdown:</div>
              <div className="text-sm text-muted-foreground space-y-1">
                {skippedReasons.excludedDirs > 0 && (
                  <div className="flex items-center gap-2">
                    <FolderX className="h-4 w-4" />
                    <span>{skippedReasons.excludedDirs.toLocaleString()} in node_modules, .git, dist, etc.</span>
                  </div>
                )}
                {skippedReasons.unsupportedExtension > 0 && (
                  <div className="flex items-center gap-2">
                    <FileX className="h-4 w-4" />
                    <span>{skippedReasons.unsupportedExtension.toLocaleString()} unsupported file types</span>
                  </div>
                )}
                {skippedReasons.tooLarge > 0 && (
                  <div className="flex items-center gap-2">
                    <FileX className="h-4 w-4" />
                    <span>{skippedReasons.tooLarge.toLocaleString()} files too large (&gt;1MB)</span>
                  </div>
                )}
                {skippedReasons.binary > 0 && (
                  <div className="flex items-center gap-2">
                    <FileX className="h-4 w-4" />
                    <span>{skippedReasons.binary.toLocaleString()} binary files</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Ready files */}
          {files.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <FileCode className="h-4 w-4" />
              <span>{files.length.toLocaleString()} code files ready for indexing</span>
            </div>
          )}

          {files.length === 0 && (
            <div className="text-center text-destructive py-2">
              No supported code files found in this directory.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={files.length === 0}>
            <span>Index {files.length.toLocaleString()} Files</span>
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
