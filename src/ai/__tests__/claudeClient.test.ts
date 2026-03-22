import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AITimeoutError, InsufficientCreditsError } from '../../utils/errors';

vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock Anthropic SDK using vi.hoisted so it's available before module init
const { mockCreate } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
}));

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: mockCreate,
    },
  })),
}));

import { analyzeWithClaude } from '../claudeClient';

describe('analyzeWithClaude', () => {
  let savedEnv: Record<string, string | undefined>;

  beforeEach(() => {
    vi.clearAllMocks();
    savedEnv = {
      KIE_AI_API_KEY: process.env.KIE_AI_API_KEY,
      OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
      MODEL: process.env.MODEL,
      KIE_MODEL: process.env.KIE_MODEL,
      KIE_API_BASE_URL: process.env.KIE_API_BASE_URL,
    };
    delete process.env.KIE_AI_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    process.env.ANTHROPIC_API_KEY = 'test-key';
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  describe('Anthropic provider', () => {
    it('should return the text response on success', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: '{"result": "ok"}' }],
      });

      const result = await analyzeWithClaude('system prompt', 'user prompt');

      expect(result).toBe('{"result": "ok"}');
      expect(mockCreate).toHaveBeenCalledOnce();
    });

    it('should retry on network errors and eventually succeed', async () => {
      vi.useFakeTimers();
      mockCreate
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue({
          content: [{ type: 'text', text: 'success after retry' }],
        });

      const resultPromise = analyzeWithClaude('system', 'user');
      await vi.advanceTimersByTimeAsync(1001);
      const result = await resultPromise;

      expect(result).toBe('success after retry');
      expect(mockCreate).toHaveBeenCalledTimes(2);
    });

    it('should throw AITimeoutError immediately without retry on timeout', async () => {
      mockCreate.mockRejectedValue(new AITimeoutError());

      await expect(analyzeWithClaude('system', 'user')).rejects.toBeInstanceOf(AITimeoutError);
      // Should NOT retry — AITimeoutError is rethrown immediately
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it('should throw InsufficientCreditsError after reducing tokens once', async () => {
      mockCreate.mockRejectedValue(new InsufficientCreditsError(0));

      await expect(analyzeWithClaude('system', 'user')).rejects.toBeInstanceOf(
        InsufficientCreditsError
      );
    });

    it('should reduce tokens and retry when InsufficientCreditsError has available tokens', async () => {
      mockCreate
        .mockRejectedValueOnce(new InsufficientCreditsError(1024))
        .mockResolvedValue({
          content: [{ type: 'text', text: 'success with reduced tokens' }],
        });

      const result = await analyzeWithClaude('system', 'user');

      expect(result).toBe('success with reduced tokens');
      expect(mockCreate).toHaveBeenCalledTimes(2);
      // Second call should use reduced max_tokens
      expect(mockCreate).toHaveBeenLastCalledWith(
        expect.objectContaining({ max_tokens: 1024 })
      );
    });
  });

  describe('OpenRouter provider', () => {
    beforeEach(() => {
      delete process.env.ANTHROPIC_API_KEY;
      process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
      process.env.MODEL = 'anthropic/claude-sonnet-4-20250514';
      global.fetch = vi.fn();
    });

    it('should call OpenRouter API and return response content', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'openrouter response' } }],
        }),
      } as Response);

      const result = await analyzeWithClaude('system', 'user');

      expect(result).toBe('openrouter response');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://openrouter.ai/api/v1/chat/completions',
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('should throw InsufficientCreditsError on 402 response', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 402,
        text: async () => 'can only afford 500 tokens in your budget',
      } as Response);

      await expect(analyzeWithClaude('system', 'user')).rejects.toBeInstanceOf(
        InsufficientCreditsError
      );
    });

    it('should parse available tokens from 402 response body', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 402,
        text: async () => 'can only afford 750 tokens',
      } as Response);

      const error = await analyzeWithClaude('system', 'user').catch((e) => e as InsufficientCreditsError);

      expect(error).toBeInstanceOf(InsufficientCreditsError);
      expect(error.availableTokens).toBe(750);
    });
  });

  describe('KIE.AI provider', () => {
    let mockFetch: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.OPENROUTER_API_KEY;
      process.env.KIE_AI_API_KEY = 'test-kie-key';
      process.env.KIE_MODEL = 'claude-sonnet-4-6';
      mockFetch = vi.fn();
      global.fetch = mockFetch as any;
    });

    it('should create task and poll until completion', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            task_id: 'task_123',
            status: 'processing',
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            status: 'processing',
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            status: 'completed',
            output: 'kie.ai response',
          }),
        });

      const result = await analyzeWithClaude('system', 'user');

      expect(result).toBe('kie.ai response');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.kie.ai/v1/chat/completions',
        expect.objectContaining({ method: 'POST' })
      );
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.kie.ai/v1/task/task_123',
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('should throw error if task creation fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Invalid API key',
      });

      await expect(analyzeWithClaude('system', 'user')).rejects.toThrow(
        'KIE.AI API error: 401 - Invalid API key'
      );
    });

    it('should throw error if task fails during polling', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            task_id: 'task_123',
            status: 'processing',
          }),
        })
        .mockResolvedValue({
          ok: true,
          json: async () => ({
            status: 'failed',
            error: 'Model unavailable',
          }),
        });

      await expect(analyzeWithClaude('system', 'user')).rejects.toThrow(
        'KIE.AI task failed: Model unavailable'
      );
    });

    it('should throw InsufficientCreditsError on 402 response', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 402,
          text: async () => 'can only afford 500 tokens in your budget',
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 402,
          text: async () => 'can only afford 500 tokens in your budget',
        });

      await expect(analyzeWithClaude('system', 'user')).rejects.toBeInstanceOf(
        InsufficientCreditsError
      );
    });

    it('should throw error if no task_id returned', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'processing',
        }),
      });

      await expect(analyzeWithClaude('system', 'user')).rejects.toThrow(
        'KIE.AI did not return a task_id'
      );
    });
  });
});
