/**
 * Persistent API key pool with cooldown tracking for rate limit handling
 */

const COOLDOWN_MS = 30 * 1000; // 30 seconds cooldown after rate limit

/**
 * @typedef {Object} KeyEntry
 * @property {string} key - The API key
 * @property {string} label - User-defined label for the key
 */

/**
 * Global state for key pools - persists across requests
 * Map of poolId -> { entries: KeyEntry[], cooldowns: Map<number, number> }
 */
const pools = new Map();

/**
 * Normalize keys to KeyEntry format (handles both old string[] and new {key, label}[] formats)
 * @param {(string|KeyEntry)[]} keys - Array of keys (strings or objects)
 * @returns {KeyEntry[]} Normalized entries
 */
function normalizeKeys(keys) {
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
    .filter(Boolean);
}

/**
 * Get or create a persistent key pool
 * @param {string} poolId - Unique identifier for this pool (e.g., 'llm', 'embeddings')
 * @param {(string|KeyEntry)[]} keys - Array of API keys (strings or {key, label} objects)
 * @returns {Object} Key pool with rotation methods
 */
export function getKeyPool(poolId, keys) {
  const entries = normalizeKeys(keys);

  // Check if pool exists and has same keys
  const existing = pools.get(poolId);
  if (existing && entriesEqual(existing.entries, entries)) {
    console.log(`[KeyPool] Reusing pool "${poolId}" (lastUsedIndex: ${existing.lastUsedIndex})`);
    return createPoolInterface(poolId, existing);
  }

  // Create new pool state
  console.log(`[KeyPool] Creating new pool "${poolId}" with ${entries.length} keys`);
  const poolState = {
    entries,
    cooldowns: new Map(), // index -> timestamp when cooldown expires
  };
  pools.set(poolId, poolState);

  return createPoolInterface(poolId, poolState);
}

/**
 * Check if two entry arrays are equal (by key only)
 */
function entriesEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].key !== b[i].key) return false;
  }
  return true;
}

/**
 * Create the pool interface for a given state
 */
function createPoolInterface(poolId, state) {
  // Track last used index for round-robin
  if (state.lastUsedIndex === undefined) {
    state.lastUsedIndex = -1;
  }

  return {
    /**
     * Get the next available key (not in cooldown) using round-robin
     * @returns {{ key: string, label: string, index: number } | null}
     */
    getAvailableKey() {
      const now = Date.now();
      const numKeys = state.entries.length;

      // Start from the next key after the last used one (round-robin)
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

    /**
     * Get the label for a key by index
     * @param {number} index - Key index
     * @returns {string}
     */
    getLabel(index) {
      return state.entries[index]?.label || `Key ${index + 1}`;
    },

    /**
     * Mark a key as rate-limited (starts cooldown)
     * @param {number} index - Key index
     */
    markRateLimited(index) {
      state.cooldowns.set(index, Date.now() + COOLDOWN_MS);
    },

    /**
     * Get time until next key becomes available (in ms)
     * @returns {number} Milliseconds until a key is available, 0 if one is available now
     */
    getTimeUntilAvailable() {
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

    /**
     * Check if any keys are available
     * @returns {boolean}
     */
    hasAvailableKey() {
      return this.getAvailableKey() !== null;
    },

    /**
     * Get total number of keys
     * @returns {number}
     */
    getKeyCount() {
      return state.entries.length;
    },

    /**
     * Get number of keys currently in cooldown
     * @returns {number}
     */
    getKeysInCooldown() {
      const now = Date.now();
      let count = 0;
      for (const [, expires] of state.cooldowns) {
        if (now < expires) count++;
      }
      return count;
    },

    /**
     * Clear all cooldowns (useful for testing or reset)
     */
    clearCooldowns() {
      state.cooldowns.clear();
    },
  };
}

/**
 * Check if an error is a rate limit or quota error that warrants key rotation
 * @param {Error} err - The error to check
 * @returns {boolean}
 */
export function isRateLimitError(err) {
  if (!err) return false;

  const message = (err.message || '').toLowerCase();
  const status = err.status || err.statusCode || err.code;

  // HTTP status codes
  if (status === 429 || status === 503) {
    return true;
  }

  // Common rate limit / quota error messages
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

  return rateLimitPatterns.some(pattern => message.includes(pattern));
}

/**
 * Sleep for a given number of milliseconds
 * @param {number} ms
 * @returns {Promise<void>}
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
