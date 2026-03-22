import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../utils/logger';
import { AITimeoutError, InsufficientCreditsError } from '../utils/errors';

type Provider = 'anthropic' | 'openrouter' | 'kie';

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
 * Priority: KIE.AI > OpenRouter > Anthropic
 */
function getProvider(): Provider {
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
 * Call KIE.AI API using native fetch (OpenAI-compatible endpoint)
 * Uses Claude Sonnet model via KIE.AI's unified API
 */
async function callKie(systemPrompt: string, userPrompt: string, maxTokens = 4096): Promise<string> {
  const model = process.env.KIE_MODEL || 'claude-sonnet-4-6';
  const apiKey = process.env.KIE_AI_API_KEY;

  if (!apiKey) {
    throw new Error('KIE_AI_API_KEY not set');
  }

  const response = await fetch('https://api.kie.ai/v1/chat/completions', {
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
    throw new Error(`KIE.AI API error: ${response.status} - ${errorBody}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('Unexpected response format from KIE.AI');
  }

  return content;
}

/**
 * Analyze content with Claude (using either Anthropic, OpenRouter, or KIE.AI)
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
      
      if (provider === 'anthropic') {
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
