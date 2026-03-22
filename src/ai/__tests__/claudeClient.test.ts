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
      GEMINI_API_KEY: process.env.GEMINI_API_KEY,
      KIE_AI_API_KEY: process.env.KIE_AI_API_KEY,
      OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
      MODEL: process.env.MODEL,
      KIE_MODEL: process.env.KIE_MODEL,
      KIE_API_BASE_URL: process.env.KIE_API_BASE_URL,
      GEMINI_MODEL: process.env.GEMINI_MODEL,
    };
    delete process.env.GEMINI_API_KEY;
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
      mockCreate.mockRejectedValueOnce(new Error('Network error')).mockResolvedValue({
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
      mockCreate.mockRejectedValueOnce(new InsufficientCreditsError(1024)).mockResolvedValue({
        content: [{ type: 'text', text: 'success with reduced tokens' }],
      });

      const result = await analyzeWithClaude('system', 'user');

      expect(result).toBe('success with reduced tokens');
      expect(mockCreate).toHaveBeenCalledTimes(2);
      // Second call should use reduced max_tokens
      expect(mockCreate).toHaveBeenLastCalledWith(expect.objectContaining({ max_tokens: 1024 }));
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

      const error = await analyzeWithClaude('system', 'user').catch(
        (e) => e as InsufficientCreditsError
      );

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

    it('should call KIE.AI Claude endpoint and return text content', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          type: 'message',
          content: [{ type: 'text', text: 'kie.ai response' }],
        }),
      });

      const result = await analyzeWithClaude('system', 'user');

      expect(result).toBe('kie.ai response');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.kie.ai/claude/v1/messages',
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('should throw error on 401 response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Invalid API key',
      });

      await expect(analyzeWithClaude('system', 'user')).rejects.toThrow(
        'KIE.AI API error: 401 - Invalid API key'
      );
    });

    it('should throw error when response contains error object', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          error: { message: 'Model unavailable', type: 'invalid_request_error' },
        }),
      });

      await expect(analyzeWithClaude('system', 'user')).rejects.toThrow(
        'KIE.AI API error: Model unavailable'
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

    it('should throw error when no text content in response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          type: 'message',
          content: [],
        }),
      });

      await expect(analyzeWithClaude('system', 'user')).rejects.toThrow(
        'KIE.AI returned no text content'
      );
    });

    it('should combine system and user prompts in a single message per KIE.AI spec', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          type: 'message',
          content: [{ type: 'text', text: 'ok' }],
        }),
      });

      await analyzeWithClaude('my system prompt', 'my user prompt');

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.model).toBe('claude-sonnet-4-6');
      expect(callBody.system).toBeUndefined();
      expect(callBody.messages).toEqual([{ role: 'user', content: 'my system prompt\n\nmy user prompt' }]);
      expect(callBody.stream).toBe(false);
    });
  });

  describe('Gemini provider', () => {
    let mockFetch: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.OPENROUTER_API_KEY;
      delete process.env.KIE_AI_API_KEY;
      process.env.GEMINI_API_KEY = 'test-gemini-key';
      mockFetch = vi.fn();
      global.fetch = mockFetch as any;
    });

    it('should call Gemini API and return text content', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: 'gemini response' }] } }],
        }),
      });

      const result = await analyzeWithClaude('system', 'user');

      expect(result).toBe('gemini response');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('generativelanguage.googleapis.com'),
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('should send system_instruction and contents in Gemini format', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: 'ok' }] } }],
        }),
      });

      await analyzeWithClaude('my system prompt', 'my user prompt');

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.system_instruction).toEqual({ parts: [{ text: 'my system prompt' }] });
      expect(callBody.contents).toEqual([{ parts: [{ text: 'my user prompt' }] }]);
      expect(callBody.generationConfig.temperature).toBe(0);
    });

    it('should throw error on non-ok HTTP response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Bad request',
      });

      await expect(analyzeWithClaude('system', 'user')).rejects.toThrow(
        'Gemini API error: 400 - Bad request'
      );
    });

    it('should throw error when no text content in response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [],
        }),
      });

      await expect(analyzeWithClaude('system', 'user')).rejects.toThrow(
        'Gemini returned no text content'
      );
    });

    it('should use default model gemini-2.5-flash', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: 'ok' }] } }],
        }),
      });

      await analyzeWithClaude('system', 'user');

      expect(mockFetch.mock.calls[0][0]).toContain('gemini-2.5-flash');
    });
  });
});
