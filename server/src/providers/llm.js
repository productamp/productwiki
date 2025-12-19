import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config/index.js';
import { logError } from '../services/errorLog.js';

/**
 * Get LLM model for a specific API key and system prompt
 */
function getClient(apiKey, systemPrompt, model) {
  const key = apiKey || process.env.GOOGLE_API_KEY;
  if (!key) {
    throw new Error('Google API key is required. Set it in Settings or GOOGLE_API_KEY environment variable.');
  }
  const genAI = new GoogleGenerativeAI(key);
  return genAI.getGenerativeModel({
    model: model || config.llmModel,
    systemInstruction: {
      parts: [{ text: systemPrompt }],
    },
  });
}

/**
 * Stream chat completion
 */
export async function* streamChat(systemPrompt, messages, apiKey, model) {
  const llm = getClient(apiKey, systemPrompt, model);

  // Convert messages to Gemini format
  const history = messages.slice(0, -1).map((msg) => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }],
  }));

  const lastMessage = messages[messages.length - 1];

  try {
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
  } catch (err) {
    logError(`LLM streaming error: ${err.message}`);
    throw err;
  }
}
