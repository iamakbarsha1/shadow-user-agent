import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../utils/logger';
import { AITimeoutError, InsufficientCreditsError } from '../utils/errors';

type Provider = 'anthropic' | 'openrouter' | 'kie' | 'gemini';

const MAX_RETRIES = 2;
const TIMEOUT_MS = 60000;

// Anthropic client
let anthropicClient: Anthropic | null = null;

function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  return anthropicClient;
}

/**
 * Determine which AI provider to use based on environment variables
 * Priority: Gemini > KIE.AI > OpenRouter > Anthropic
 */
function getProvider(): Provider {
  if (process.env.GEMINI_API_KEY) {
    return 'gemini';
  }
  if (process.env.KIE_AI_API_KEY) {
    return 'kie';
  }
  if (process.env.OPENROUTER_API_KEY) {
    return 'openrouter';
  }
  return 'anthropic';
}

/**
 * Call Anthropic API directly using the SDK
 */
async function callAnthropic(systemPrompt: string, userPrompt: string, maxTokens = 4096): Promise<string> {
  const client = getAnthropicClient();
  const MODEL = 'claude-sonnet-4-20250514';

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    temperature: 0,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const content = response.content[0];
  if (content.type === 'text') {
    return content.text;
  }

  throw new Error('Unexpected response format from Anthropic');
}

/**
 * Call OpenRouter API using native fetch (OpenAI-compatible endpoint)
 */
async function callOpenRouter(systemPrompt: string, userPrompt: string, maxTokens = 4096): Promise<string> {
  const model = process.env.MODEL || 'anthropic/claude-sonnet-4-20250514';
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY not set');
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'shadow-user-agent',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    if (response.status === 402) {
      const match = errorBody.match(/can only afford (\d+)/);
      const available = match ? parseInt(match[1], 10) : 0;
      throw new InsufficientCreditsError(available);
    }
    throw new Error(`OpenRouter API error: ${response.status} - ${errorBody}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('Unexpected response format from OpenRouter');
  }

  return content;
}

/**
 * Call KIE.AI API using native fetch
 * Uses Anthropic Messages API format via KIE.AI proxy endpoint
 * Endpoint: POST https://api.kie.ai/claude/v1/messages
 */
async function callKie(systemPrompt: string, userPrompt: string, _maxTokens = 4096): Promise<string> {
  const model = process.env.KIE_MODEL || 'claude-sonnet-4-6';
  const apiKey = process.env.KIE_AI_API_KEY;

  if (!apiKey) {
    throw new Error('KIE_AI_API_KEY not set');
  }

  // KIE.AI API only supports: model, messages, tools, thinkingFlag, stream
  // No system or max_tokens fields — embed system prompt in user message
  const combinedContent = `${systemPrompt}\n\n${userPrompt}`;

  const response = await fetch('https://api.kie.ai/claude/v1/messages', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'user', content: combinedContent },
      ],
      stream: false,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    if (response.status === 402) {
      const match = errorBody.match(/can only afford (\d+)/);
      const available = match ? parseInt(match[1], 10) : 0;
      throw new InsufficientCreditsError(available);
    }
    if (response.status === 401) {
      throw new Error('KIE.AI API error: 401 - Invalid API key');
    }
    throw new Error(`KIE.AI API error: ${response.status} - ${errorBody}`);
  }

  const data = (await response.json()) as {
    content?: Array<{ type: string; text?: string }>;
    type?: string;
    stop_reason?: string;
    error?: { message?: string; type?: string };
    code?: number;
    msg?: string;
  };

  // KIE.AI returns HTTP 200 with application-level error codes in the body
  if (data.code && data.code !== 200) {
    throw new Error(`KIE.AI API error (${data.code}): ${data.msg || 'Unknown error'}`);
  }

  if (data.error) {
    throw new Error(`KIE.AI API error: ${data.error.message || 'Unknown error'}`);
  }

  const textBlock = data.content?.find((block) => block.type === 'text');
  if (!textBlock?.text) {
    logger.error({ responseKeys: Object.keys(data), content: data.content, stopReason: data.stop_reason }, 'KIE.AI returned unexpected response shape');
    throw new Error('KIE.AI returned no text content');
  }

  logger.info({ provider: 'kie', model, stopReason: data.stop_reason }, 'KIE.AI response received');

  return textBlock.text;
}

/**
 * Call Google Gemini API using native fetch
 * Endpoint: POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
 */
async function callGemini(systemPrompt: string, userPrompt: string, _maxTokens = 4096): Promise<string> {
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not set');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'x-goog-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      system_instruction: {
        parts: [{ text: systemPrompt }],
      },
      contents: [
        {
          parts: [{ text: userPrompt }],
        },
      ],
      generationConfig: {
        temperature: 0,
      },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errorBody}`);
  }

  const data = (await response.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
      finishReason?: string;
    }>;
    error?: { message?: string; code?: number };
  };

  if (data.error) {
    throw new Error(`Gemini API error: ${data.error.message || 'Unknown error'}`);
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    logger.error({ responseKeys: Object.keys(data), candidates: data.candidates }, 'Gemini returned unexpected response shape');
    throw new Error('Gemini returned no text content');
  }

  logger.info({ provider: 'gemini', model }, 'Gemini response received');

  return text;
}

/**
 * Analyze content with AI (using Gemini, Anthropic, OpenRouter, or KIE.AI)
 * Implements retry logic and timeout handling for all providers
 */
export async function analyzeWithClaude(
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const provider = getProvider();
  let lastError: Error | null = null;
  let currentMaxTokens = 4096;
  let hasReducedTokens = false;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      let call: Promise<string>;
      
      if (provider === 'gemini') {
        call = callGemini(systemPrompt, userPrompt, currentMaxTokens);
      } else if (provider === 'anthropic') {
        call = callAnthropic(systemPrompt, userPrompt, currentMaxTokens);
      } else if (provider === 'kie') {
        call = callKie(systemPrompt, userPrompt, currentMaxTokens);
      } else {
        call = callOpenRouter(systemPrompt, userPrompt, currentMaxTokens);
      }

      const response = await Promise.race([
        call,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new AITimeoutError()), TIMEOUT_MS)
        ),
      ]);

      return response;
    } catch (error) {
      lastError = error as Error;

      if (error instanceof AITimeoutError) {
        throw error;
      }

      if (error instanceof InsufficientCreditsError) {
        if (!hasReducedTokens && error.availableTokens > 0) {
          hasReducedTokens = true;
          currentMaxTokens = error.availableTokens;
          logger.warn(
            { availableTokens: error.availableTokens, provider },
            'Insufficient credits: retrying with reduced max_tokens'
          );
          continue; // retry immediately with reduced tokens
        }
        throw error; // already reduced once, or zero credits — give up
      }

      // Non-transient API errors should not be retried
      const msg = (error as Error).message || '';
      if (msg.startsWith('KIE.AI') || msg.startsWith('OpenRouter') || msg.startsWith('Gemini')) {
        throw error;
      }

      // Retry on network errors or 529 (overloaded)
      if (attempt < MAX_RETRIES) {
        const delay = Math.pow(2, attempt) * 1000;
        logger.warn({ attempt, delay, provider }, 'Retrying AI API call');
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
    }
  }

  throw lastError || new Error(`${provider} API call failed`);
}
