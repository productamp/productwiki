/**
 * LLM provider for Gemma-3-27b-it via Google AI Studio
 */
import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from './config.js';
import { getKeyPool, isRateLimitError, sleep, KeyEntry } from './api-key-pool.js';

/**
 * Check if a model is a Gemma model (doesn't support systemInstruction)
 */
function isGemmaModel(model: string): boolean {
  return model && model.toLowerCase().includes('gemma');
}

/**
 * Get LLM model for a specific API key and system prompt
 */
function getClient(apiKey: string, systemPrompt: string, model: string) {
  const key = apiKey || process.env.GOOGLE_API_KEY;
  if (!key) {
    throw new Error('Google API key is required. Set it in Settings or GOOGLE_API_KEY environment variable.');
  }

  const genAI = new GoogleGenerativeAI(key);
  const modelName = model || config.llmModel;

  // Gemma models don't support systemInstruction
  if (isGemmaModel(modelName)) {
    return genAI.getGenerativeModel({ model: modelName });
  }

  return genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
  });
}

/**
 * Check if error is a stream parsing error that should be retried
 */
function isStreamParseError(err: unknown): boolean {
  const message = (err as { message?: string })?.message?.toLowerCase() || '';
  return (
    message.includes('failed to parse stream') ||
    (message.includes('stream') && message.includes('error'))
  );
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Stream chat with a single key
 */
async function* streamChatWithKey(
  systemPrompt: string,
  messages: Message[],
  apiKey: string,
  model: string
): AsyncGenerator<string> {
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
  const totalChars =
    (systemPrompt?.length || 0) +
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
 * Log error (simplified for serverless)
 */
function logError(message: string): void {
  console.error(`[LLM Error] ${message}`);
}

/**
 * Stream chat completion with automatic key rotation on rate limit errors
 */
export async function* streamChat(
  systemPrompt: string,
  messages: Message[],
  apiKeys?: (string | KeyEntry)[],
  model?: string
): AsyncGenerator<string> {
  // Normalize to array
  const keys: (string | KeyEntry)[] = Array.isArray(apiKeys)
    ? apiKeys
    : [apiKeys].filter(Boolean) as (string | KeyEntry)[];

  // Add env fallback if no keys provided
  if (keys.length === 0 && process.env.GOOGLE_API_KEY) {
    keys.push(process.env.GOOGLE_API_KEY);
  }

  if (keys.length === 0) {
    throw new Error('Google API key is required. Set it in Settings or GOOGLE_API_KEY environment variable.');
  }

  // Get persistent pool for LLM
  const pool = getKeyPool('llm', keys);

  let streamRetries = 0;
  const MAX_STREAM_RETRIES = 2;

  while (true) {
    const available = pool.getAvailableKey();

    if (!available) {
      const waitTime = pool.getTimeUntilAvailable();
      const keysInCooldown = pool.getKeysInCooldown();
      const waitSeconds = Math.ceil(waitTime / 1000);
      const errorMsg = `All ${keysInCooldown} API key(s) rate limited. Try again in ${waitSeconds}s or add more API keys in Settings.`;
      logError(errorMsg);
      throw new Error(errorMsg);
    }

    const { key, label, index } = available;
    console.log(`[LLM] Using "${label}" (index ${index})`);

    try {
      yield* streamChatWithKey(systemPrompt, messages, key, model || config.llmModel);
      return;
    } catch (err) {
      if (isRateLimitError(err)) {
        pool.markRateLimited(index);
        logError(`Rate limit hit on "${label}" (${index + 1}/${pool.getKeyCount()}), cooldown started`);
        continue;
      }
      // Retry stream parsing errors
      if (isStreamParseError(err) && streamRetries < MAX_STREAM_RETRIES) {
        streamRetries++;
        console.log(`[LLM] Stream parse error on "${label}", retrying (${streamRetries}/${MAX_STREAM_RETRIES})...`);
        await sleep(1000 * streamRetries);
        continue;
      }
      logError(`LLM error on "${label}": ${(err as Error).message}`);
      throw err;
    }
  }
}
