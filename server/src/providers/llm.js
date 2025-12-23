import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config/index.js';
import { logError } from '../services/errorLog.js';
import { getKeyPool, isRateLimitError, sleep } from './api-key-pool.js';
import { checkTpmAllowance, recordTokenUsage, estimateTokens } from './tpm-tracker.js';

/**
 * Check if a model is a Gemma model (doesn't support systemInstruction)
 */
function isGemmaModel(model) {
  return model && model.toLowerCase().includes('gemma');
}

/**
 * Get LLM model for a specific API key and system prompt
 */
function getClient(apiKey, systemPrompt, model) {
  if (!apiKey) {
    throw new Error('Google API key is required.');
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  const modelName = model || config.llmModel;

  // Gemma models don't support systemInstruction
  if (isGemmaModel(modelName)) {
    return genAI.getGenerativeModel({ model: modelName });
  }

  return genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: {
      parts: [{ text: systemPrompt }],
    },
  });
}

/**
 * Check if error is a stream parsing error that should be retried
 */
function isStreamParseError(err) {
  const message = err?.message?.toLowerCase() || '';
  return message.includes('failed to parse stream') ||
    message.includes('stream') && message.includes('error');
}

/**
 * Stream chat with a single key (internal implementation)
 */
async function* streamChatWithKey(systemPrompt, messages, apiKey, model) {
  const modelName = model || config.llmModel;
  const llm = getClient(apiKey, systemPrompt, modelName);

  // For Gemma models, prepend system prompt to the first user message
  let processedMessages = messages;
  if (isGemmaModel(modelName) && systemPrompt) {
    processedMessages = messages.map((msg, idx) => {
      if (idx === 0 && msg.role === 'user') {
        return {
          ...msg,
          content: `<system>\n${systemPrompt}\n</system>\n\n${msg.content}`,
        };
      }
      return msg;
    });
  }

  // Convert messages to Gemini format
  const history = processedMessages.slice(0, -1).map((msg) => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }],
  }));

  const lastMessage = processedMessages[processedMessages.length - 1];

  // Log prompt size for debugging
  const totalChars = (systemPrompt?.length || 0) +
    processedMessages.reduce((sum, m) => sum + (m.content?.length || 0), 0);
  const estimatedTokens = Math.ceil(totalChars / 4);
  console.log(`[LLM] Request to ${modelName}: ~${totalChars} chars (~${estimatedTokens} tokens)`);

  // Start chat
  const chat = llm.startChat({ history });

  // Stream the response
  const result = await chat.sendMessageStream(lastMessage.content);

  for await (const chunk of result.stream) {
    const text = chunk.text();
    if (text) {
      yield text;
    }
  }
}

/**
 * Stream chat completion with automatic key rotation on rate limit errors
 * @param {string} systemPrompt - System prompt
 * @param {Array} messages - Chat messages
 * @param {string|string[]} apiKeys - Single key or array of keys
 * @param {string} model - Model name
 * @param {Object} tpmOptions - TPM rate limit options { lowTpmMode, tpmLimit }
 */
export async function* streamChat(systemPrompt, messages, apiKeys, model, tpmOptions = {}) {
  const { lowTpmMode, tpmLimit = 15000 } = tpmOptions;

  // Normalize to array
  const keys = Array.isArray(apiKeys) ? apiKeys : [apiKeys].filter(Boolean);

  // Add server-side keys as fallback if no user keys provided
  if (keys.length === 0 && config.googleApiKeys.length > 0) {
    keys.push(...config.googleApiKeys);
  }

  if (keys.length === 0) {
    throw new Error('Google API key is required. Set it in Settings or GOOGLE_API_KEYS environment variable.');
  }

  // Get persistent pool for LLM
  const pool = getKeyPool('llm', keys);

  let streamRetries = 0;
  const MAX_STREAM_RETRIES = 2;

  // Calculate estimated tokens for TPM tracking
  const inputChars = (systemPrompt?.length || 0) +
    messages.reduce((sum, m) => sum + (m.content?.length || 0), 0);
  const estimatedInputTokens = estimateTokens(inputChars);
  // Estimate output as roughly equal to input (conservative)
  const estimatedTotalTokens = estimatedInputTokens * 2;

  while (true) {
    const available = pool.getAvailableKey();

    if (!available) {
      // All keys in cooldown - throw error instead of waiting
      const waitTime = pool.getTimeUntilAvailable();
      const keysInCooldown = pool.getKeysInCooldown();
      const waitSeconds = Math.ceil(waitTime / 1000);
      const errorMsg = `All ${keysInCooldown} API key(s) rate limited. Try again in ${waitSeconds}s or add more API keys in Settings.`;
      logError(errorMsg);
      throw new Error(errorMsg);
    }

    const { key, label, index } = available;
    // Use last 8 chars of key as ID for TPM tracking
    const keyId = typeof key === 'string' ? key.slice(-8) : (key.key?.slice(-8) || `key-${index}`);

    // Check TPM allowance if low TPM mode is enabled
    if (lowTpmMode) {
      const check = checkTpmAllowance(keyId, estimatedTotalTokens, tpmLimit);
      if (!check.allowed) {
        const waitSeconds = Math.ceil(check.waitMs / 1000);
        console.log(`[TPM] Waiting ${waitSeconds}s before request (${check.currentUsage}/${tpmLimit} tokens used)`);
        await sleep(check.waitMs);
      }
    }

    console.log(`[LLM] Using "${label}" (index ${index})`);

    try {
      let outputChars = 0;
      for await (const chunk of streamChatWithKey(systemPrompt, messages, key, model)) {
        outputChars += chunk.length;
        yield chunk;
      }

      // Record actual token usage after successful streaming
      if (lowTpmMode) {
        const actualTokens = estimateTokens(inputChars + outputChars);
        recordTokenUsage(keyId, actualTokens);
      }

      return;
    } catch (err) {
      if (isRateLimitError(err)) {
        pool.markRateLimited(index);
        logError(`Rate limit hit on "${label}" (${index + 1}/${pool.getKeyCount()}), cooldown started`);
        continue;
      }
      // Retry stream parsing errors (often transient network issues)
      if (isStreamParseError(err) && streamRetries < MAX_STREAM_RETRIES) {
        streamRetries++;
        console.log(`[LLM] Stream parse error on "${label}", retrying (${streamRetries}/${MAX_STREAM_RETRIES})...`);
        await sleep(1000 * streamRetries); // Exponential backoff
        continue;
      }
      logError(`LLM error on "${label}": ${err.message}`);
      throw err;
    }
  }
}
