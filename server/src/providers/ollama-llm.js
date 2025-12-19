import { config } from '../config/index.js';
import { logError } from '../services/errorLog.js';

/**
 * Get Ollama host URL from environment or config
 */
function getOllamaHost() {
  // OLLAMA_HOST is the standard env var used by Ollama
  let host = process.env.OLLAMA_HOST || config.ollamaHost || 'http://localhost:11434';
  // Remove /api suffix if present
  if (host.endsWith('/api')) {
    host = host.slice(0, -4);
  }
  return host;
}

/**
 * Check if an Ollama model is available
 */
export async function checkModelAvailable(modelName) {
  const host = getOllamaHost();

  try {
    const response = await fetch(`${host}/api/tags`, { timeout: 5000 });
    if (!response.ok) {
      return { available: false, error: 'Could not connect to Ollama' };
    }

    const data = await response.json();
    const models = data.models || [];

    // Check for exact match or base name match (e.g., "llama3.2" matches "llama3.2:latest")
    const modelBase = modelName.split(':')[0];
    const found = models.some((m) => {
      const name = m.name || '';
      return name === modelName || name.startsWith(`${modelBase}:`);
    });

    if (!found) {
      const availableNames = models.map((m) => m.name).join(', ');
      return {
        available: false,
        error: `Model '${modelName}' not found. Available: ${availableNames || 'none'}`,
      };
    }

    return { available: true };
  } catch (err) {
    return { available: false, error: `Cannot connect to Ollama at ${host}: ${err.message}` };
  }
}

/**
 * Stream chat completion using Ollama
 */
export async function* streamChat(systemPrompt, messages) {
  const host = getOllamaHost();
  const model = config.ollamaLlmModel || 'llama3.2';

  // Build messages array with system prompt
  const ollamaMessages = [
    { role: 'system', content: systemPrompt },
    ...messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    })),
  ];

  try {
    const response = await fetch(`${host}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: ollamaMessages,
        stream: true,
        options: {
          temperature: 0.7,
          num_ctx: 32000,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama API error: ${response.status} - ${errorText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter((line) => line.trim());

      for (const line of lines) {
        try {
          const json = JSON.parse(line);
          if (json.message?.content) {
            yield json.message.content;
          }
          if (json.error) {
            throw new Error(json.error);
          }
        } catch (parseErr) {
          // Skip non-JSON lines
          if (parseErr.message && !parseErr.message.includes('JSON')) {
            throw parseErr;
          }
        }
      }
    }
  } catch (err) {
    logError(`Ollama LLM streaming error: ${err.message}`);
    throw err;
  }
}
