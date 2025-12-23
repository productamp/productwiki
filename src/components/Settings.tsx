import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog'
import { Settings as SettingsIcon, Check, Plus, X, Crown, Package, RefreshCw, BookOpen, Zap, Cloud, Server } from 'lucide-react'
import { getApiKeyEntries, setApiKeyEntries, getGroqApiKeyEntries, setGroqApiKeyEntries, getPreset, setPreset, isPlusUser, setPlusAccessCode, getLowTpmMode, setLowTpmMode as setLowTpmModeStorage, getTpmLimit, setTpmLimit as setTpmLimitStorage, type Preset, type ApiKeyEntry } from '@/lib/api'

interface SettingsProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type SettingsTab = 'ai-providers' | 'plus'

export function Settings({ open, onOpenChange }: SettingsProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('ai-providers')
  const [apiKeys, setApiKeysState] = useState<ApiKeyEntry[]>([{ key: '', label: '' }])
  const [groqApiKeys, setGroqApiKeysState] = useState<ApiKeyEntry[]>([{ key: '', label: '' }])
  const [preset, setPresetState] = useState<Preset>('groq-cloud')
  const [plusAccessCode, setPlusAccessCodeState] = useState('')
  const [isPlusActive, setIsPlusActive] = useState(false)
  const [lowTpmMode, setLowTpmMode] = useState(false)
  const [tpmLimit, setTpmLimit] = useState(15000)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (open) {
      const entries = getApiKeyEntries()
      setApiKeysState(entries.length > 0 ? entries : [{ key: '', label: '' }])
      const groqEntries = getGroqApiKeyEntries()
      setGroqApiKeysState(groqEntries.length > 0 ? groqEntries : [{ key: '', label: '' }])
      setPresetState(getPreset())
      setIsPlusActive(isPlusUser())
      setLowTpmMode(getLowTpmMode())
      setTpmLimit(getTpmLimit())
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

    // Save Groq API keys
    const filteredGroq = groqApiKeys
      .filter(e => e.key.trim())
      .map((e, i) => ({
        key: e.key,
        label: e.label.trim() || `Key ${i + 1}`,
      }))
    setGroqApiKeyEntries(filteredGroq)

    setPreset(preset)
    setLowTpmModeStorage(lowTpmMode)
    setTpmLimitStorage(tpmLimit)

    // Handle Plus access code
    const wasPlusActive = isPlusActive
    let nowPlusActive = wasPlusActive
    if (plusAccessCode.trim()) {
      const success = setPlusAccessCode(plusAccessCode.trim())
      setIsPlusActive(success)
      nowPlusActive = success
    }

    setSaved(true)
    setTimeout(() => {
      onOpenChange(false)
      // Refresh page if Plus status changed to show/hide Plus-only tools
      if (nowPlusActive !== wasPlusActive) {
        window.location.reload()
      }
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

  const addGroqApiKey = () => {
    setGroqApiKeysState([...groqApiKeys, { key: '', label: '' }])
  }

  const removeGroqApiKey = (index: number) => {
    if (groqApiKeys.length > 1) {
      setGroqApiKeysState(groqApiKeys.filter((_, i) => i !== index))
    } else {
      setGroqApiKeysState([{ key: '', label: '' }])
    }
  }

  const updateGroqApiKey = (index: number, field: 'key' | 'label', value: string) => {
    const newKeys = [...groqApiKeys]
    newKeys[index] = { ...newKeys[index], [field]: value }
    setGroqApiKeysState(newKeys)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[600px] p-0 gap-0 overflow-hidden">
        <div className="flex h-full min-h-0">
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
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto p-6 min-h-0">
              {activeTab === 'ai-providers' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-1">AI Provider</h3>
                    <p className="text-sm text-muted-foreground">
                      Choose your AI provider for text generation
                    </p>
                  </div>

                  {/* Provider Cards - 3 in a row */}
                  <div className="grid grid-cols-3 gap-3">
                    {/* Groq */}
                    <button
                      onClick={() => setPresetState('groq-cloud')}
                      className={`py-4 px-3 flex flex-col items-center justify-center rounded-lg border-2 transition-colors ${
                        preset === 'groq-cloud'
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <Zap className={`h-6 w-6 mb-1.5 ${preset === 'groq-cloud' ? 'text-primary' : 'text-muted-foreground'}`} />
                      <span className={`text-sm font-medium ${preset === 'groq-cloud' ? 'text-primary' : ''}`}>Groq</span>
                    </button>

                    {/* Gemini */}
                    <button
                      onClick={() => setPresetState('gemini-cloud')}
                      className={`py-4 px-3 flex flex-col items-center justify-center rounded-lg border-2 transition-colors ${
                        preset === 'gemini-cloud'
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <Cloud className={`h-6 w-6 mb-1.5 ${preset === 'gemini-cloud' ? 'text-primary' : 'text-muted-foreground'}`} />
                      <span className={`text-sm font-medium ${preset === 'gemini-cloud' ? 'text-primary' : ''}`}>Gemini</span>
                    </button>

                    {/* Ollama */}
                    <button
                      onClick={() => setPresetState('local-llm')}
                      className={`py-4 px-3 flex flex-col items-center justify-center rounded-lg border-2 transition-colors ${
                        preset === 'local-llm'
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <Server className={`h-6 w-6 mb-1.5 ${preset === 'local-llm' ? 'text-primary' : 'text-muted-foreground'}`} />
                      <span className={`text-sm font-medium ${preset === 'local-llm' ? 'text-primary' : ''}`}>Ollama</span>
                    </button>
                  </div>

                  {/* Provider Info Section */}
                  {preset === 'groq-cloud' && (
                    <div className="space-y-4 p-4 bg-muted/50 rounded-lg border">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium">Groq Cloud</h4>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-600 border border-green-500/20">
                            Recommended
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Fast inference with Llama 4.
                        </p>
                      </div>

                      <div className="space-y-2 pt-3 border-t">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-medium">Groq API Keys</label>
                          <span className="text-xs text-muted-foreground">
                            {groqApiKeys.filter(e => e.key.trim()).length} key{groqApiKeys.filter(e => e.key.trim()).length !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          For text generation.
                        </p>
                        <div className="space-y-2">
                          {groqApiKeys.map((entry, index) => (
                            <div key={index} className="flex gap-2">
                              <Input
                                type="password"
                                placeholder="gsk_..."
                                value={entry.key}
                                onChange={(e) => updateGroqApiKey(index, 'key', e.target.value)}
                                className="flex-1"
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeGroqApiKey(index)}
                                className="shrink-0"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={addGroqApiKey}
                          className="w-full"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add API Key
                        </Button>
                        <p className="text-xs text-muted-foreground">
                          Get keys from{' '}
                          <a
                            href="https://console.groq.com/keys"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline"
                          >
                            Groq Console
                          </a>
                        </p>
                      </div>

                      <div className="space-y-2 pt-3 border-t">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-medium">Google API Keys</label>
                          <span className="text-xs text-muted-foreground">
                            {apiKeys.filter(e => e.key.trim()).length} key{apiKeys.filter(e => e.key.trim()).length !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          For embeddings.
                        </p>
                        <div className="space-y-2">
                          {apiKeys.map((entry, index) => (
                            <div key={index} className="flex gap-2">
                              <Input
                                type="password"
                                placeholder="AIza..."
                                value={entry.key}
                                onChange={(e) => updateApiKey(index, 'key', e.target.value)}
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
                          Get keys from{' '}
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
                    </div>
                  )}

                  {preset === 'gemini-cloud' && (
                    <div className="space-y-4 p-4 bg-muted/50 rounded-lg border">
                      <div>
                        <h4 className="font-medium mb-1">Google Gemini</h4>
                        <p className="text-sm text-muted-foreground">
                          Google Gemini Flash - fast and capable. Requires a Google API key.
                        </p>
                      </div>

                      <div className="space-y-2 pt-3 border-t">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-medium">API Keys</label>
                          <span className="text-xs text-muted-foreground">
                            {apiKeys.filter(e => e.key.trim()).length} key{apiKeys.filter(e => e.key.trim()).length !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <div className="space-y-2">
                          {apiKeys.map((entry, index) => (
                            <div key={index} className="flex gap-2">
                              <Input
                                type="password"
                                placeholder="AIza..."
                                value={entry.key}
                                onChange={(e) => updateApiKey(index, 'key', e.target.value)}
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
                          Get keys from{' '}
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

                      <div className="space-y-2 pt-3 border-t">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-medium">Low TPM Mode</label>
                          <Button
                            variant={lowTpmMode ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setLowTpmMode(!lowTpmMode)}
                          >
                            {lowTpmMode ? 'Enabled' : 'Disabled'}
                          </Button>
                        </div>
                        {lowTpmMode && (
                          <div className="space-y-2 p-3 bg-background rounded-md">
                            <div className="flex items-center gap-2">
                              <label className="text-xs text-muted-foreground">TPM Limit:</label>
                              <Input
                                type="number"
                                min={5000}
                                max={100000}
                                value={tpmLimit}
                                onChange={(e) => setTpmLimit(parseInt(e.target.value) || 15000)}
                                className="w-24 h-8"
                              />
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Reduces context sizes to stay within token limits.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {preset === 'local-llm' && (
                    <div className="space-y-4 p-4 bg-muted/50 rounded-lg border">
                      <div>
                        <h4 className="font-medium mb-1">Ollama (Local)</h4>
                        <p className="text-sm text-muted-foreground">
                          Run AI entirely on your machine. No API key required.
                        </p>
                      </div>

                      <div className="pt-3 border-t space-y-2">
                        <p className="text-sm">
                          Make sure Ollama is running at{' '}
                          <code className="bg-background px-1.5 py-0.5 rounded text-xs">localhost:11434</code>
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Required models:
                        </p>
                        <ul className="text-xs text-muted-foreground space-y-1 ml-4">
                          <li><code className="bg-background px-1.5 py-0.5 rounded">qwen2.5-coder:3b</code> for generation</li>
                          <li><code className="bg-background px-1.5 py-0.5 rounded">nomic-embed-text</code> for embeddings</li>
                        </ul>
                      </div>
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
