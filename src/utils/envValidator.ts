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

  // Validate AI provider: must have either Anthropic or OpenRouter
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
  const hasOpenRouter = !!process.env.OPENROUTER_API_KEY;

  if (!hasAnthropic && !hasOpenRouter) {
    throw new Error(
      'Must set either ANTHROPIC_API_KEY or OPENROUTER_API_KEY. See .env.example for configuration.'
    );
  }

  // If using OpenRouter, MODEL must be specified
  if (hasOpenRouter && !process.env.MODEL) {
    throw new Error(
      'MODEL must be set when using OPENROUTER_API_KEY (e.g., anthropic/claude-sonnet-4-20250514)'
    );
  }

  // Validate NODE_ENV
  const validNodeEnv = ['development', 'production', 'test'];
  if (process.env.NODE_ENV && !validNodeEnv.includes(process.env.NODE_ENV)) {
    throw new Error(
      `Invalid NODE_ENV: ${process.env.NODE_ENV}. Must be one of: ${validNodeEnv.join(', ')}`
    );
  }
}
