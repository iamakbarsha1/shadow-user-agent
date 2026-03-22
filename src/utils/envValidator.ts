/**
 * Validates that all required environment variables are present at startup.
 * Throws an error if any required variables are missing.
 */

const REQUIRED_ENV_VARS = [
  'DATABASE_URL',
  'REDIS_URL',
  'JWT_PRIVATE_KEY',
  'JWT_PUBLIC_KEY',
  'INTERNAL_API_KEY',
] as const;

export function validateEnv(): void {
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  // Validate AI provider: must have one of Gemini, Anthropic, OpenRouter, or KIE.AI
  const hasGemini = !!process.env.GEMINI_API_KEY;
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
  const hasOpenRouter = !!process.env.OPENROUTER_API_KEY;
  const hasKie = !!process.env.KIE_AI_API_KEY;

  if (!hasGemini && !hasAnthropic && !hasOpenRouter && !hasKie) {
    throw new Error(
      'Must set either GEMINI_API_KEY, ANTHROPIC_API_KEY, OPENROUTER_API_KEY, or KIE_AI_API_KEY. See .env.example for configuration.'
    );
  }

  // If using OpenRouter, MODEL must be specified
  if (hasOpenRouter && !process.env.MODEL) {
    throw new Error(
      'MODEL must be set when using OPENROUTER_API_KEY (e.g., anthropic/claude-sonnet-4-20250514)'
    );
  }

  // If using KIE.AI, KIE_MODEL should be set (optional, has default)
  // No error thrown, just uses default model if not set

  // Validate NODE_ENV
  const validNodeEnv = ['development', 'production', 'test'];
  if (process.env.NODE_ENV && !validNodeEnv.includes(process.env.NODE_ENV)) {
    throw new Error(
      `Invalid NODE_ENV: ${process.env.NODE_ENV}. Must be one of: ${validNodeEnv.join(', ')}`
    );
  }
}
