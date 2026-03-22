import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { validateEnv } from '../envValidator';

const REQUIRED_VARS = ['DATABASE_URL', 'REDIS_URL', 'JWT_PRIVATE_KEY', 'JWT_PUBLIC_KEY', 'INTERNAL_API_KEY'];

function setValidEnv(): void {
  process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
  process.env.REDIS_URL = 'redis://localhost:6379';
  process.env.JWT_PRIVATE_KEY = 'test-private-key';
  process.env.JWT_PUBLIC_KEY = 'test-public-key';
  process.env.INTERNAL_API_KEY = 'test-api-key';
  process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
}

describe('validateEnv', () => {
  let savedEnv: Record<string, string | undefined>;

  beforeEach(() => {
    // Save current env
    savedEnv = {
      DATABASE_URL: process.env.DATABASE_URL,
      REDIS_URL: process.env.REDIS_URL,
      JWT_PRIVATE_KEY: process.env.JWT_PRIVATE_KEY,
      JWT_PUBLIC_KEY: process.env.JWT_PUBLIC_KEY,
      INTERNAL_API_KEY: process.env.INTERNAL_API_KEY,
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
      OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
      KIE_AI_API_KEY: process.env.KIE_AI_API_KEY,
      MODEL: process.env.MODEL,
      KIE_MODEL: process.env.KIE_MODEL,
      NODE_ENV: process.env.NODE_ENV,
    };
    setValidEnv();
  });

  afterEach(() => {
    // Restore saved env
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it('should pass with all required variables set and ANTHROPIC_API_KEY', () => {
    expect(() => validateEnv()).not.toThrow();
  });

  it('should pass with OPENROUTER_API_KEY and MODEL set', () => {
    delete process.env.ANTHROPIC_API_KEY;
    process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
    process.env.MODEL = 'anthropic/claude-sonnet-4-20250514';

    expect(() => validateEnv()).not.toThrow();
  });

  it('should pass with KIE_AI_API_KEY set (KIE_MODEL optional)', () => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    process.env.KIE_AI_API_KEY = 'test-kie-key';
    // KIE_MODEL is optional, uses default if not set

    expect(() => validateEnv()).not.toThrow();
  });

  it('should pass with KIE_AI_API_KEY and KIE_MODEL set', () => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    process.env.KIE_AI_API_KEY = 'test-kie-key';
    process.env.KIE_MODEL = 'claude-sonnet-4-6';

    expect(() => validateEnv()).not.toThrow();
  });

  it.each(REQUIRED_VARS)('should throw if %s is missing', (varName) => {
    delete process.env[varName];

    expect(() => validateEnv()).toThrow(`Missing required environment variables: ${varName}`);
  });

  it('should list all missing variables in the error message', () => {
    delete process.env.DATABASE_URL;
    delete process.env.REDIS_URL;

    expect(() => validateEnv()).toThrow('DATABASE_URL');
    expect(() => validateEnv()).toThrow('REDIS_URL');
  });

  it('should throw if neither ANTHROPIC_API_KEY, OPENROUTER_API_KEY, nor KIE_AI_API_KEY is set', () => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.KIE_AI_API_KEY;

    expect(() => validateEnv()).toThrow('Must set either ANTHROPIC_API_KEY, OPENROUTER_API_KEY, or KIE_AI_API_KEY');
  });

  it('should throw if OPENROUTER_API_KEY is set but MODEL is missing', () => {
    delete process.env.ANTHROPIC_API_KEY;
    process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
    delete process.env.MODEL;

    expect(() => validateEnv()).toThrow('MODEL must be set when using OPENROUTER_API_KEY');
  });

  it('should throw for invalid NODE_ENV value', () => {
    process.env.NODE_ENV = 'staging';

    expect(() => validateEnv()).toThrow('Invalid NODE_ENV: staging');
  });

  it('should accept valid NODE_ENV values', () => {
    for (const env of ['development', 'production', 'test']) {
      process.env.NODE_ENV = env;
      expect(() => validateEnv()).not.toThrow();
    }
  });

  it('should not throw if NODE_ENV is not set', () => {
    delete process.env.NODE_ENV;

    expect(() => validateEnv()).not.toThrow();
  });
});
