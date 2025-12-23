/**
 * TPM (Tokens Per Minute) Rate Limiter
 * Tracks token usage in a rolling 60-second window
 */

const WINDOW_MS = 60 * 1000; // 60 seconds

/**
 * Global state for TPM tracking per API key
 * Map of keyId -> { usage: Array<{timestamp, tokens}>, totalInWindow: number }
 */
const trackers = new Map();

/**
 * Get or create a tracker for a specific key
 * @param {string} keyId - Unique identifier for the API key
 */
function getTracker(keyId) {
  if (!trackers.has(keyId)) {
    trackers.set(keyId, { usage: [], totalInWindow: 0 });
  }
  return trackers.get(keyId);
}

/**
 * Clean up old entries outside the rolling window
 * @param {Object} tracker - The tracker object to clean
 */
function cleanupWindow(tracker) {
  const cutoff = Date.now() - WINDOW_MS;
  while (tracker.usage.length > 0 && tracker.usage[0].timestamp < cutoff) {
    tracker.totalInWindow -= tracker.usage.shift().tokens;
  }
  if (tracker.totalInWindow < 0) tracker.totalInWindow = 0;
}

/**
 * Check if a request with estimated tokens would exceed the limit
 * @param {string} keyId - Unique identifier for the API key
 * @param {number} estimatedTokens - Estimated tokens for this request
 * @param {number} tpmLimit - The TPM limit to enforce
 * @returns {{ allowed: boolean, waitMs: number, currentUsage: number }}
 */
export function checkTpmAllowance(keyId, estimatedTokens, tpmLimit) {
  const tracker = getTracker(keyId);
  cleanupWindow(tracker);

  const projectedUsage = tracker.totalInWindow + estimatedTokens;

  if (projectedUsage <= tpmLimit) {
    return { allowed: true, waitMs: 0, currentUsage: tracker.totalInWindow };
  }

  // Calculate how long to wait for enough tokens to "expire" from the window
  const tokensNeeded = projectedUsage - tpmLimit;
  let waitMs = 0;
  let accumulated = 0;

  for (const entry of tracker.usage) {
    accumulated += entry.tokens;
    if (accumulated >= tokensNeeded) {
      // Wait until this entry expires
      waitMs = Math.max(0, entry.timestamp + WINDOW_MS - Date.now());
      break;
    }
  }

  // If we couldn't find enough tokens expiring soon, wait full window
  if (waitMs === 0 && accumulated < tokensNeeded) {
    waitMs = WINDOW_MS;
  }

  return { allowed: false, waitMs, currentUsage: tracker.totalInWindow };
}

/**
 * Record token usage after a successful request
 * @param {string} keyId - Unique identifier for the API key
 * @param {number} tokens - Actual tokens used
 */
export function recordTokenUsage(keyId, tokens) {
  const tracker = getTracker(keyId);
  cleanupWindow(tracker);

  tracker.usage.push({ timestamp: Date.now(), tokens });
  tracker.totalInWindow += tokens;

  console.log(`[TPM] ${keyId}: +${tokens} tokens, window total: ${tracker.totalInWindow}`);
}

/**
 * Get current usage for a key
 * @param {string} keyId - Unique identifier for the API key
 * @returns {number} Current token usage in window
 */
export function getCurrentUsage(keyId) {
  const tracker = getTracker(keyId);
  cleanupWindow(tracker);
  return tracker.totalInWindow;
}

/**
 * Estimate tokens from character count
 * Uses same formula as llm.js: ~4 chars per token
 * @param {number} chars - Character count
 * @returns {number} Estimated tokens
 */
export function estimateTokens(chars) {
  return Math.ceil(chars / 4);
}
