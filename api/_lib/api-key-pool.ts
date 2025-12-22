/**
 * Persistent API key pool with cooldown tracking for rate limit handling
 */

const COOLDOWN_MS = 30 * 1000; // 30 seconds cooldown after rate limit

export interface KeyEntry {
  key: string;
  label: string;
}

interface PoolState {
  entries: KeyEntry[];
  cooldowns: Map<number, number>;
  lastUsedIndex: number;
}

/**
 * Global state for key pools - persists across requests in same function instance
 */
const pools = new Map<string, PoolState>();

/**
 * Normalize keys to KeyEntry format
 */
function normalizeKeys(keys: (string | KeyEntry)[]): KeyEntry[] {
  return (keys || [])
    .map((k, i) => {
      if (typeof k === 'string') {
        return k.trim() ? { key: k.trim(), label: `Key ${i + 1}` } : null;
      }
      if (k && typeof k === 'object' && k.key && k.key.trim()) {
        return { key: k.key.trim(), label: k.label || `Key ${i + 1}` };
      }
      return null;
    })
    .filter((k): k is KeyEntry => k !== null);
}

/**
 * Check if two entry arrays are equal (by key only)
 */
function entriesEqual(a: KeyEntry[], b: KeyEntry[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].key !== b[i].key) return false;
  }
  return true;
}

export interface KeyPool {
  getAvailableKey(): { key: string; label: string; index: number } | null;
  getLabel(index: number): string;
  markRateLimited(index: number): void;
  getTimeUntilAvailable(): number;
  hasAvailableKey(): boolean;
  getKeyCount(): number;
  getKeysInCooldown(): number;
  clearCooldowns(): void;
}

/**
 * Create the pool interface for a given state
 */
function createPoolInterface(poolId: string, state: PoolState): KeyPool {
  return {
    getAvailableKey() {
      const now = Date.now();
      const numKeys = state.entries.length;

      for (let offset = 1; offset <= numKeys; offset++) {
        const i = (state.lastUsedIndex + offset) % numKeys;
        const cooldownExpires = state.cooldowns.get(i) || 0;
        if (now >= cooldownExpires) {
          state.lastUsedIndex = i;
          const entry = state.entries[i];
          return { key: entry.key, label: entry.label, index: i };
        }
      }

      return null;
    },

    getLabel(index: number): string {
      return state.entries[index]?.label || `Key ${index + 1}`;
    },

    markRateLimited(index: number): void {
      state.cooldowns.set(index, Date.now() + COOLDOWN_MS);
    },

    getTimeUntilAvailable(): number {
      const now = Date.now();
      let minWait = Infinity;

      for (let i = 0; i < state.entries.length; i++) {
        const cooldownExpires = state.cooldowns.get(i) || 0;
        if (now >= cooldownExpires) {
          return 0;
        }
        minWait = Math.min(minWait, cooldownExpires - now);
      }

      return minWait === Infinity ? 0 : minWait;
    },

    hasAvailableKey(): boolean {
      return this.getAvailableKey() !== null;
    },

    getKeyCount(): number {
      return state.entries.length;
    },

    getKeysInCooldown(): number {
      const now = Date.now();
      let count = 0;
      for (const [, expires] of state.cooldowns) {
        if (now < expires) count++;
      }
      return count;
    },

    clearCooldowns(): void {
      state.cooldowns.clear();
    },
  };
}

/**
 * Get or create a persistent key pool
 */
export function getKeyPool(poolId: string, keys: (string | KeyEntry)[]): KeyPool {
  const entries = normalizeKeys(keys);

  const existing = pools.get(poolId);
  if (existing && entriesEqual(existing.entries, entries)) {
    console.log(`[KeyPool] Reusing pool "${poolId}" (lastUsedIndex: ${existing.lastUsedIndex})`);
    return createPoolInterface(poolId, existing);
  }

  console.log(`[KeyPool] Creating new pool "${poolId}" with ${entries.length} keys`);
  const poolState: PoolState = {
    entries,
    cooldowns: new Map(),
    lastUsedIndex: -1,
  };
  pools.set(poolId, poolState);

  return createPoolInterface(poolId, poolState);
}

/**
 * Check if an error is a rate limit or quota error
 */
export function isRateLimitError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;

  const error = err as { message?: string; status?: number; statusCode?: number; code?: number };
  const message = (error.message || '').toLowerCase();
  const status = error.status || error.statusCode || error.code;

  if (status === 429 || status === 503) {
    return true;
  }

  const rateLimitPatterns = [
    'rate limit',
    'rate_limit',
    'ratelimit',
    'quota',
    'exhausted',
    'too many requests',
    'resource exhausted',
    'exceeded',
  ];

  return rateLimitPatterns.some((pattern) => message.includes(pattern));
}

/**
 * Sleep for a given number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
