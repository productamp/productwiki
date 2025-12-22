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
import { Settings as SettingsIcon, Check, Plus, X, Crown } from 'lucide-react'
import { getApiKeyEntries, setApiKeyEntries, getProvider, setProvider, getGeminiModel, setGeminiModel, isPlusUser, setPlusAccessCode, DEFAULT_GEMINI_MODEL, type LlmProvider, type ApiKeyEntry } from '@/lib/api'

interface SettingsProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function Settings({ open, onOpenChange }: SettingsProps) {
  const [apiKeys, setApiKeysState] = useState<ApiKeyEntry[]>([{ key: '', label: '' }])
  const [provider, setProviderState] = useState<LlmProvider>('gemini')
  const [geminiModel, setGeminiModelState] = useState(DEFAULT_GEMINI_MODEL)
  const [plusAccessCode, setPlusAccessCodeState] = useState('')
  const [isPlusActive, setIsPlusActive] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (open) {
      const entries = getApiKeyEntries()
      setApiKeysState(entries.length > 0 ? entries : [{ key: '', label: '' }])
      setProviderState(getProvider())
      setGeminiModelState(getGeminiModel())
      setIsPlusActive(isPlusUser())
      setPlusAccessCodeState('')
      setSaved(false)
    }
  }, [open])

  const handleSave = () => {
    // Filter out empty keys and assign default labels if missing
    const filtered = apiKeys
      .filter(e => e.key.trim())
      .map((e, i) => ({
        key: e.key,
        label: e.label.trim() || `Key ${i + 1}`,
      }))
    setApiKeyEntries(filtered)
    setProvider(provider)
    setGeminiModel(geminiModel)

    // Handle Plus access code
    if (plusAccessCode.trim()) {
      const success = setPlusAccessCode(plusAccessCode.trim())
      setIsPlusActive(success)
    }

    setSaved(true)
    setTimeout(() => {
      onOpenChange(false)
    }, 500)
  }

  const addApiKey = () => {
    setApiKeysState([...apiKeys, { key: '', label: '' }])
  }

  const removeApiKey = (index: number) => {
    if (apiKeys.length > 1) {
      setApiKeysState(apiKeys.filter((_, i) => i !== index))
    } else {
      setApiKeysState([{ key: '', label: '' }])
    }
  }

  const updateApiKey = (index: number, field: 'key' | 'label', value: string) => {
    const newKeys = [...apiKeys]
    newKeys[index] = { ...newKeys[index], [field]: value }
    setApiKeysState(newKeys)
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
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Google API Keys</label>
                  <span className="text-xs text-muted-foreground">
                    {apiKeys.filter(e => e.key.trim()).length} key{apiKeys.filter(e => e.key.trim()).length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="space-y-3">
                  {apiKeys.map((entry, index) => (
                    <div key={index} className="space-y-1.5 p-3 border rounded-md">
                      <div className="flex gap-2">
                        <Input
                          type="text"
                          placeholder={`Key ${index + 1}`}
                          value={entry.label}
                          onChange={(e) => updateApiKey(index, 'label', e.target.value)}
                          className="flex-1"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeApiKey(index)}
                          className="shrink-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <Input
                        type="password"
                        placeholder="AIza..."
                        value={entry.key}
                        onChange={(e) => updateApiKey(index, 'key', e.target.value)}
                      />
                    </div>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addApiKey}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add API Key
                </Button>
                <p className="text-xs text-muted-foreground">
                  Add multiple keys to rotate when rate limited. Get keys from{' '}
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

          <div className="space-y-2 pt-4 border-t">
            <div className="flex items-center gap-2">
              <Crown className="h-4 w-4 text-primary" />
              <label className="text-sm font-medium">Plus Access</label>
              {isPlusActive && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  Active
                </span>
              )}
            </div>
            <Input
              type="password"
              placeholder="Enter access code"
              value={plusAccessCode}
              onChange={(e) => setPlusAccessCodeState(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Enter your Plus access code to unlock Package Prompt and Reimplement tools
            </p>
          </div>

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
      >
        <SettingsIcon className="h-5 w-5" />
      </Button>
      <Settings open={open} onOpenChange={setOpen} />
    </>
  )
}
