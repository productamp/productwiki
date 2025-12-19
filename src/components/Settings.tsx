import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Settings as SettingsIcon, Check } from 'lucide-react'
import { setApiKey, getApiKey, getProvider, setProvider, getGeminiModel, setGeminiModel, DEFAULT_GEMINI_MODEL, type LlmProvider } from '@/lib/api'

interface SettingsProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function Settings({ open, onOpenChange }: SettingsProps) {
  const [apiKey, setApiKeyState] = useState('')
  const [provider, setProviderState] = useState<LlmProvider>('gemini')
  const [geminiModel, setGeminiModelState] = useState(DEFAULT_GEMINI_MODEL)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (open) {
      setApiKeyState(getApiKey() || '')
      setProviderState(getProvider())
      setGeminiModelState(getGeminiModel())
      setSaved(false)
    }
  }, [open])

  const handleSave = () => {
    setApiKey(apiKey)
    setProvider(provider)
    setGeminiModel(geminiModel)
    setSaved(true)
    setTimeout(() => {
      onOpenChange(false)
    }, 500)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SettingsIcon className="h-5 w-5" />
            Settings
          </DialogTitle>
          <DialogDescription>
            Configure your LLM provider for embeddings and generation.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">LLM Provider</label>
            <div className="flex gap-2">
              <Button
                variant={provider === 'gemini' ? 'default' : 'outline'}
                onClick={() => setProviderState('gemini')}
                className="flex-1"
              >
                Gemini
              </Button>
              <Button
                variant={provider === 'ollama' ? 'default' : 'outline'}
                onClick={() => setProviderState('ollama')}
                className="flex-1"
              >
                Ollama
              </Button>
            </div>
          </div>

          {provider === 'gemini' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Google API Key</label>
                <Input
                  type="password"
                  placeholder="AIza..."
                  value={apiKey}
                  onChange={(e) => setApiKeyState(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Get your API key from{' '}
                  <a
                    href="https://aistudio.google.com/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    Google AI Studio
                  </a>
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Model</label>
                <Input
                  type="text"
                  placeholder={DEFAULT_GEMINI_MODEL}
                  value={geminiModel}
                  onChange={(e) => setGeminiModelState(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Default: {DEFAULT_GEMINI_MODEL}
                </p>
              </div>
            </div>
          )}

          {provider === 'ollama' && (
            <div className="space-y-2 p-3 bg-muted rounded-md">
              <p className="text-sm">
                Ollama runs locally - no API key required.
              </p>
              <p className="text-xs text-muted-foreground">
                Make sure Ollama is running at{' '}
                <code className="bg-background px-1 rounded">localhost:11434</code>
              </p>
              <p className="text-xs text-muted-foreground">
                Required models: <code className="bg-background px-1 rounded">qwen2.5-coder:3b</code> and{' '}
                <code className="bg-background px-1 rounded">nomic-embed-text</code>
              </p>
            </div>
          )}

          <Button onClick={handleSave} className="w-full">
            {saved ? (
              <>
                <Check className="mr-2 h-4 w-4" />
                Saved
              </>
            ) : (
              'Save Settings'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function SettingsButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        className="absolute top-4 right-4"
      >
        <SettingsIcon className="h-5 w-5" />
      </Button>
      <Settings open={open} onOpenChange={setOpen} />
    </>
  )
}
