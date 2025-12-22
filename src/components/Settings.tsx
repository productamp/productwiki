import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog'
import { Settings as SettingsIcon, Check, Plus, X, Crown, Package, RefreshCw, BookOpen } from 'lucide-react'
import { getApiKeyEntries, setApiKeyEntries, getProvider, setProvider, getGeminiModel, setGeminiModel, isPlusUser, setPlusAccessCode, DEFAULT_GEMINI_MODEL, type LlmProvider, type ApiKeyEntry } from '@/lib/api'

interface SettingsProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type SettingsTab = 'ai-providers' | 'plus'

export function Settings({ open, onOpenChange }: SettingsProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('ai-providers')
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
      setActiveTab('ai-providers')
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
      <DialogContent onClose={() => onOpenChange(false)} className="w-[1200px] h-[600px] p-0 overflow-hidden">
        <div className="flex h-full">
          {/* Sidebar */}
          <div className="w-48 border-r bg-muted/30 p-4 space-y-1">
            <h2 className="px-3 mb-4 text-sm font-semibold flex items-center gap-2">
              <SettingsIcon className="h-4 w-4" />
              Settings
            </h2>
            <button
              onClick={() => setActiveTab('ai-providers')}
              className={`w-full px-3 py-2 text-sm text-left rounded-md transition-colors ${
                activeTab === 'ai-providers'
                  ? 'bg-background text-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
              }`}
            >
              AI Providers
            </button>
            <button
              onClick={() => setActiveTab('plus')}
              className={`w-full px-3 py-2 text-sm text-left rounded-md transition-colors flex items-center gap-2 ${
                activeTab === 'plus'
                  ? 'bg-background text-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
              }`}
            >
              <Crown className="h-3.5 w-3.5" />
              Plus Mode
              {isPlusActive && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />
              )}
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 flex flex-col">
            <div className="flex-1 overflow-y-auto p-6">
              {activeTab === 'ai-providers' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-1">AI Providers</h3>
                    <p className="text-sm text-muted-foreground">
                      Configure your LLM provider for embeddings and generation
                    </p>
                  </div>

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
                </div>
              )}

              {activeTab === 'plus' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-1 flex items-center gap-2">
                      <Crown className="h-5 w-5 text-primary" />
                      Plus Mode
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Unlock premium features with an access code
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="p-4 bg-muted/50 rounded-lg border">
                      <h4 className="text-sm font-medium mb-2">Premium Features</h4>
                      <ul className="space-y-1.5 text-sm text-muted-foreground">
                        <li className="flex items-center gap-2">
                          <BookOpen className="h-3.5 w-3.5" />
                          Quick Documentation - Single-page technical docs
                        </li>
                        <li className="flex items-center gap-2">
                          <Package className="h-3.5 w-3.5" />
                          Package Prompt - Migrate SaaS to Electron
                        </li>
                        <li className="flex items-center gap-2">
                          <RefreshCw className="h-3.5 w-3.5" />
                          Reimplement - Rebuild with React/Vite/shadcn
                        </li>
                      </ul>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium">Access Code</label>
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
                        Enter your Plus access code to unlock premium tools
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer with Save Button */}
            <div className="border-t p-4">
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
          </div>
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
