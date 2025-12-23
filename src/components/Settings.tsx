import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog'
import { Settings as SettingsIcon, Check, Plus, X, Crown, Package, RefreshCw, BookOpen, Zap, Cloud, Server } from 'lucide-react'
import { getApiKeyEntries, setApiKeyEntries, getPreset, setPreset, isPlusUser, setPlusAccessCode, getLowTpmMode, setLowTpmMode as setLowTpmModeStorage, getTpmLimit, setTpmLimit as setTpmLimitStorage, PRESETS, type Preset, type ApiKeyEntry } from '@/lib/api'

interface SettingsProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type SettingsTab = 'ai-providers' | 'plus'

export function Settings({ open, onOpenChange }: SettingsProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('ai-providers')
  const [apiKeys, setApiKeysState] = useState<ApiKeyEntry[]>([{ key: '', label: '' }])
  const [preset, setPresetState] = useState<Preset>('best-free-cloud')
  const [plusAccessCode, setPlusAccessCodeState] = useState('')
  const [isPlusActive, setIsPlusActive] = useState(false)
  const [lowTpmMode, setLowTpmMode] = useState(false)
  const [tpmLimit, setTpmLimit] = useState(15000)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (open) {
      const entries = getApiKeyEntries()
      setApiKeysState(entries.length > 0 ? entries : [{ key: '', label: '' }])
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

  const presetRequiresGoogleKey = preset === 'gemini-cloud' || preset === 'gemma-cloud'

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
                    <h3 className="text-lg font-semibold mb-1">AI Provider Preset</h3>
                    <p className="text-sm text-muted-foreground">
                      Choose how to run embeddings and text generation
                    </p>
                  </div>

                  {/* Preset Selection */}
                  <div className="space-y-3">
                    {/* Best Free Cloud - Recommended */}
                    <button
                      onClick={() => setPresetState('best-free-cloud')}
                      className={`w-full p-4 text-left rounded-lg border-2 transition-colors ${
                        preset === 'best-free-cloud'
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 p-2 rounded-lg ${preset === 'best-free-cloud' ? 'bg-primary/10' : 'bg-muted'}`}>
                          <Zap className="h-4 w-4" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{PRESETS['best-free-cloud'].name}</span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-600 border border-green-500/20">
                              Recommended
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-0.5">
                            {PRESETS['best-free-cloud'].description}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Uses Groq (Llama 4) + Jina AI embeddings
                          </p>
                        </div>
                      </div>
                    </button>

                    {/* Gemini Cloud */}
                    <button
                      onClick={() => setPresetState('gemini-cloud')}
                      className={`w-full p-4 text-left rounded-lg border-2 transition-colors ${
                        preset === 'gemini-cloud'
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 p-2 rounded-lg ${preset === 'gemini-cloud' ? 'bg-primary/10' : 'bg-muted'}`}>
                          <Cloud className="h-4 w-4" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{PRESETS['gemini-cloud'].name}</span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-0.5">
                            {PRESETS['gemini-cloud'].description}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Requires Google API key
                          </p>
                        </div>
                      </div>
                    </button>

                    {/* Gemma Cloud */}
                    <button
                      onClick={() => setPresetState('gemma-cloud')}
                      className={`w-full p-4 text-left rounded-lg border-2 transition-colors ${
                        preset === 'gemma-cloud'
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 p-2 rounded-lg ${preset === 'gemma-cloud' ? 'bg-primary/10' : 'bg-muted'}`}>
                          <Cloud className="h-4 w-4" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{PRESETS['gemma-cloud'].name}</span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-0.5">
                            {PRESETS['gemma-cloud'].description}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Requires Google API key
                          </p>
                        </div>
                      </div>
                    </button>

                    {/* Local LLM */}
                    <button
                      onClick={() => setPresetState('local-llm')}
                      className={`w-full p-4 text-left rounded-lg border-2 transition-colors ${
                        preset === 'local-llm'
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 p-2 rounded-lg ${preset === 'local-llm' ? 'bg-primary/10' : 'bg-muted'}`}>
                          <Server className="h-4 w-4" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{PRESETS['local-llm'].name}</span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-0.5">
                            {PRESETS['local-llm'].description}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Requires Ollama running locally
                          </p>
                        </div>
                      </div>
                    </button>
                  </div>

                  {/* Conditional Settings based on preset */}
                  {presetRequiresGoogleKey && (
                    <div className="space-y-4 pt-4 border-t">
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

                      <div className="space-y-2 pt-4 border-t">
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
                          <div className="space-y-2 p-3 bg-muted rounded-md">
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
                              Reduces context sizes and adds delays to stay within token limits.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {preset === 'local-llm' && (
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
