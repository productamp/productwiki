/**
 * IndexedDB storage layer for user settings
 * Provides persistent storage for API keys, provider selection, and cached content
 */
import { openDB, DBSchema, IDBPDatabase } from 'idb';

export interface ApiKeyEntry {
  key: string;
  label: string;
}

export type LlmProvider = 'gemini' | 'ollama';

export interface UserSettings {
  apiKeys: ApiKeyEntry[];
  provider: LlmProvider;
  geminiModel: string;
}

interface ProductWikiDB extends DBSchema {
  settings: {
    key: string;
    value: UserSettings;
  };
  cache: {
    key: string;
    value: {
      content: string;
      structure?: unknown;
      generatedAt: string;
    };
  };
}

const DB_NAME = 'productwiki';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<ProductWikiDB>> | null = null;

/**
 * Get or initialize the database
 */
function getDB(): Promise<IDBPDatabase<ProductWikiDB>> {
  if (!dbPromise) {
    dbPromise = openDB<ProductWikiDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Create settings store
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings');
        }
        // Create cache store for generated content
        if (!db.objectStoreNames.contains('cache')) {
          db.createObjectStore('cache');
        }
      },
    });
  }
  return dbPromise;
}

/**
 * Default settings
 */
const DEFAULT_SETTINGS: UserSettings = {
  apiKeys: [],
  provider: 'gemini',
  geminiModel: 'gemma-3-27b-it',
};

/**
 * Get user settings from IndexedDB
 * Falls back to localStorage for migration, then to defaults
 */
export async function getSettings(): Promise<UserSettings> {
  try {
    const db = await getDB();
    const stored = await db.get('settings', 'user');

    if (stored) {
      return stored;
    }

    // Migrate from localStorage if exists
    const migratedSettings = migrateFromLocalStorage();
    if (migratedSettings) {
      await saveSettings(migratedSettings);
      return migratedSettings;
    }

    return DEFAULT_SETTINGS;
  } catch (error) {
    console.warn('IndexedDB not available, falling back to localStorage:', error);
    return getSettingsFromLocalStorage();
  }
}

/**
 * Save user settings to IndexedDB
 */
export async function saveSettings(settings: Partial<UserSettings>): Promise<void> {
  try {
    const db = await getDB();
    const current = await getSettings();
    const updated = { ...current, ...settings };
    await db.put('settings', updated, 'user');

    // Also update localStorage for backwards compatibility
    syncToLocalStorage(updated);
  } catch (error) {
    console.warn('IndexedDB not available, falling back to localStorage:', error);
    saveSettingsToLocalStorage(settings);
  }
}

/**
 * Get API keys
 */
export async function getApiKeys(): Promise<ApiKeyEntry[]> {
  const settings = await getSettings();
  return settings.apiKeys;
}

/**
 * Save API keys
 */
export async function saveApiKeys(apiKeys: ApiKeyEntry[]): Promise<void> {
  await saveSettings({ apiKeys });
}

/**
 * Get LLM provider
 */
export async function getProvider(): Promise<LlmProvider> {
  const settings = await getSettings();
  return settings.provider;
}

/**
 * Save LLM provider
 */
export async function saveProvider(provider: LlmProvider): Promise<void> {
  await saveSettings({ provider });
}

/**
 * Get Gemini model
 */
export async function getGeminiModel(): Promise<string> {
  const settings = await getSettings();
  return settings.geminiModel;
}

/**
 * Save Gemini model
 */
export async function saveGeminiModel(model: string): Promise<void> {
  await saveSettings({ geminiModel: model });
}

// ============ Cache Functions ============

/**
 * Get cached content
 */
export async function getCachedContent(key: string): Promise<{ content: string; structure?: unknown; generatedAt: string } | null> {
  try {
    const db = await getDB();
    return await db.get('cache', key) || null;
  } catch {
    return null;
  }
}

/**
 * Save content to cache
 */
export async function setCachedContent(
  key: string,
  content: string,
  structure?: unknown
): Promise<void> {
  try {
    const db = await getDB();
    await db.put('cache', {
      content,
      structure,
      generatedAt: new Date().toISOString(),
    }, key);
  } catch (error) {
    console.warn('Failed to cache content:', error);
  }
}

/**
 * Clear cached content
 */
export async function clearCache(): Promise<void> {
  try {
    const db = await getDB();
    await db.clear('cache');
  } catch (error) {
    console.warn('Failed to clear cache:', error);
  }
}

// ============ LocalStorage Helpers (for migration and fallback) ============

const LS_API_KEYS = 'productwiki_api_keys';
const LS_API_KEY = 'productwiki_api_key';
const LS_PROVIDER = 'productwiki_llm_provider';
const LS_MODEL = 'productwiki_gemini_model';

/**
 * Migrate settings from localStorage
 */
function migrateFromLocalStorage(): UserSettings | null {
  try {
    const apiKeysStr = localStorage.getItem(LS_API_KEYS);
    const singleKey = localStorage.getItem(LS_API_KEY);
    const provider = localStorage.getItem(LS_PROVIDER);
    const model = localStorage.getItem(LS_MODEL);

    // Check if there's anything to migrate
    if (!apiKeysStr && !singleKey && !provider && !model) {
      return null;
    }

    let apiKeys: ApiKeyEntry[] = [];
    if (apiKeysStr) {
      try {
        apiKeys = JSON.parse(apiKeysStr);
      } catch {
        apiKeys = [];
      }
    }

    // Fallback to single key
    if (apiKeys.length === 0 && singleKey) {
      apiKeys = [{ key: singleKey, label: 'Key 1' }];
    }

    return {
      apiKeys,
      provider: (provider as LlmProvider) || 'gemini',
      geminiModel: model || 'gemma-3-27b-it',
    };
  } catch {
    return null;
  }
}

/**
 * Get settings from localStorage (fallback)
 */
function getSettingsFromLocalStorage(): UserSettings {
  try {
    const apiKeysStr = localStorage.getItem(LS_API_KEYS);
    const singleKey = localStorage.getItem(LS_API_KEY);
    const provider = localStorage.getItem(LS_PROVIDER);
    const model = localStorage.getItem(LS_MODEL);

    let apiKeys: ApiKeyEntry[] = [];
    if (apiKeysStr) {
      try {
        apiKeys = JSON.parse(apiKeysStr);
      } catch {
        apiKeys = [];
      }
    }
    if (apiKeys.length === 0 && singleKey) {
      apiKeys = [{ key: singleKey, label: 'Key 1' }];
    }

    return {
      apiKeys,
      provider: (provider as LlmProvider) || 'gemini',
      geminiModel: model || 'gemma-3-27b-it',
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/**
 * Save settings to localStorage (fallback)
 */
function saveSettingsToLocalStorage(settings: Partial<UserSettings>): void {
  try {
    if (settings.apiKeys !== undefined) {
      localStorage.setItem(LS_API_KEYS, JSON.stringify(settings.apiKeys));
      if (settings.apiKeys.length > 0) {
        localStorage.setItem(LS_API_KEY, settings.apiKeys[0].key);
      }
    }
    if (settings.provider !== undefined) {
      localStorage.setItem(LS_PROVIDER, settings.provider);
    }
    if (settings.geminiModel !== undefined) {
      localStorage.setItem(LS_MODEL, settings.geminiModel);
    }
  } catch {
    // Ignore localStorage errors
  }
}

/**
 * Sync settings to localStorage (for backwards compatibility)
 */
function syncToLocalStorage(settings: UserSettings): void {
  try {
    localStorage.setItem(LS_API_KEYS, JSON.stringify(settings.apiKeys));
    if (settings.apiKeys.length > 0) {
      localStorage.setItem(LS_API_KEY, settings.apiKeys[0].key);
    }
    localStorage.setItem(LS_PROVIDER, settings.provider);
    localStorage.setItem(LS_MODEL, settings.geminiModel);
  } catch {
    // Ignore localStorage errors
  }
}
