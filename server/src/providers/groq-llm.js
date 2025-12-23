import { config } from '../config/index.js';
import { logError } from '../services/errorLog.js';
import { getKeyPool, isRateLimitError, sleep } from './api-key-pool.js';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';

/**
 * Parse SSE stream line and extract content
 * @param {string} line - SSE data line
 * @returns {string|null} Content text or null
 */
function parseSSELine(line) {
  if (!line.startsWith('data: ')) return null;
  const data = line.slice(6).trim();
  if (data === '[DONE]') return null;

  try {
    const parsed = JSON.parse(data);
    return parsed.choices?.[0]?.delta?.content || null;
  } catch {
    return null;
  }
}

/**
 * Stream chat with a single Groq API key
 * @param {string} systemPrompt - System prompt
 * @param {Array} messages - Chat messages [{role, content}]
 * @param {string} apiKey - Groq API key
 */
async function* streamChatWithKey(systemPrompt, messages, apiKey) {
  // Build OpenAI-compatible messages array
  const apiMessages = [];

  // Add system message if provided
  if (systemPrompt) {
    apiMessages.push({ role: 'system', content: systemPrompt });
  }

  // Add conversation messages
  for (const msg of messages) {
    apiMessages.push({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content,
    });
  }

  // Log request size
  const totalChars = (systemPrompt?.length || 0) +
    messages.reduce((sum, m) => sum + (m.content?.length || 0), 0);
  const estimatedTokens = Math.ceil(totalChars / 4);
  console.log(`[Groq] Request to ${GROQ_MODEL}: ~${totalChars} chars (~${estimatedTokens} tokens)`);

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: apiMessages,
      stream: true,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    const error = new Error(`Groq API error: ${response.status} ${response.statusText} - ${errorBody}`);
    error.status = response.status;
    throw error;
  }

  // Parse SSE stream
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Process complete lines
    const lines = buffer.split('\n');
    buffer = lines.pop() || ''; // Keep incomplete line in buffer

    for (const line of lines) {
      const content = parseSSELine(line);
      if (content) {
        yield content;
      }
    }
  }

  // Process any remaining buffer
  if (buffer.trim()) {
    const content = parseSSELine(buffer);
    if (content) {
      yield content;
    }
  }
}

/**
 * Check if error is a stream parsing error that should be retried
 */
function isStreamParseError(err) {
  const message = err?.message?.toLowerCase() || '';
  return message.includes('failed to parse stream') ||
    (message.includes('stream') && message.includes('error'));
}

/**
 * Stream chat completion with Groq API
 * Supports key rotation on rate limit errors
 * @param {string} systemPrompt - System prompt
 * @param {Array} messages - Chat messages
 * @param {string|string[]|Object[]} apiKeys - Single key, array of keys, or array of {key, label} objects
 */
export async function* streamChat(systemPrompt, messages, apiKeys) {
  // Normalize to array
  let keys = Array.isArray(apiKeys) ? apiKeys : [apiKeys].filter(Boolean);

  // Add server-side keys as fallback if no user keys provided
  if (keys.length === 0 && config.groqApiKeys && config.groqApiKeys.length > 0) {
    keys = config.groqApiKeys;
  }

  if (keys.length === 0) {
    throw new Error('Groq API key is required. Set it in Settings or GROQ_API_KEY environment variable.');
  }

  // Get persistent pool for Groq LLM
  const pool = getKeyPool('groq-llm', keys);

  let streamRetries = 0;
  const MAX_STREAM_RETRIES = 2;

  while (true) {
    const available = pool.getAvailableKey();

    if (!available) {
      const waitTime = pool.getTimeUntilAvailable();
      const keysInCooldown = pool.getKeysInCooldown();
      const waitSeconds = Math.ceil(waitTime / 1000);
      const errorMsg = `All ${keysInCooldown} Groq API key(s) rate limited. Try again in ${waitSeconds}s or add more API keys.`;
      logError(errorMsg);
      throw new Error(errorMsg);
    }

    const { key, label, index } = available;
    console.log(`[Groq] Using "${label}" (index ${index})`);

    try {
      for await (const chunk of streamChatWithKey(systemPrompt, messages, key)) {
        yield chunk;
      }
      return;
    } catch (err) {
      if (isRateLimitError(err)) {
        pool.markRateLimited(index);
        logError(`Rate limit hit on Groq "${label}" (${index + 1}/${pool.getKeyCount()}), cooldown started`);
        continue;
      }
      // Retry stream parsing errors
      if (isStreamParseError(err) && streamRetries < MAX_STREAM_RETRIES) {
        streamRetries++;
        console.log(`[Groq] Stream parse error on "${label}", retrying (${streamRetries}/${MAX_STREAM_RETRIES})...`);
        await sleep(1000 * streamRetries);
        continue;
      }
      logError(`Groq error on "${label}": ${err.message}`);
      throw err;
    }
  }
}
