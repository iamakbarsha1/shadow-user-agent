import { vi, describe, it, expect, beforeAll, afterEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';

// Mock prisma
vi.mock('../../db/client', () => ({
  prisma: {
    $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
    $disconnect: vi.fn(),
    run: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

// Mock ioredis
vi.mock('ioredis', () => {
  const RedisMock = vi.fn().mockImplementation(() => ({
    ping: vi.fn().mockResolvedValue('PONG'),
    disconnect: vi.fn(),
    quit: vi.fn(),
    on: vi.fn(),
  }));
  return { default: RedisMock };
});

// Mock queue (imported transitively)
vi.mock('../../worker/queue', () => ({
  enqueueAgentRun: vi.fn().mockResolvedValue('mock-job-id'),
  getJobStatus: vi.fn(),
  closeQueue: vi.fn(),
}));

import { createApp } from '../app';
import { prisma } from '../../db/client';

const AI_ENV_KEYS = ['GEMINI_API_KEY', 'KIE_AI_API_KEY', 'OPENROUTER_API_KEY', 'ANTHROPIC_API_KEY'] as const;

function pickAiEnv(): Record<string, string | undefined> {
  const env: Record<string, string | undefined> = {};
  for (const key of AI_ENV_KEYS) env[key] = process.env[key];
  return env;
}

function clearAiEnv(): void {
  for (const key of AI_ENV_KEYS) delete process.env[key];
}

function restoreAiEnv(saved: Record<string, string | undefined>): void {
  for (const [key, value] of Object.entries(saved)) {
    if (value !== undefined) process.env[key] = value;
    else delete process.env[key];
  }
}

describe('Health API', () => {
  let app: Express;

  beforeAll(() => {
    app = createApp();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /health', () => {
    it('should return 200 with service status', async () => {
      const res = await request(app).get('/health');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status');
      expect(res.body).toHaveProperty('db');
      expect(res.body).toHaveProperty('redis');
      expect(res.body).toHaveProperty('ai_provider');
      expect(res.body).toHaveProperty('version');
      expect(res.body.version).toBe('1.0.0');
    });

    it('should not require authentication', async () => {
      const res = await request(app).get('/health');

      expect(res.status).not.toBe(401);
    });

    it('should report anthropic as ai_provider when ANTHROPIC_API_KEY is set', async () => {
      const saved = { ...pickAiEnv() };
      clearAiEnv();
      process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';

      const res = await request(app).get('/health');
      restoreAiEnv(saved);

      expect(res.body.ai_provider).toBe('anthropic');
    });

    it('should report openrouter as ai_provider when OPENROUTER_API_KEY is set', async () => {
      const saved = { ...pickAiEnv() };
      clearAiEnv();
      process.env.OPENROUTER_API_KEY = 'test-openrouter-key';

      const res = await request(app).get('/health');
      restoreAiEnv(saved);

      expect(res.body.ai_provider).toBe('openrouter');
    });

    it('should report kie as ai_provider when KIE_AI_API_KEY is set', async () => {
      const saved = { ...pickAiEnv() };
      clearAiEnv();
      process.env.KIE_AI_API_KEY = 'test-kie-key';

      const res = await request(app).get('/health');
      restoreAiEnv(saved);

      expect(res.body.ai_provider).toBe('kie');
    });

    it('should report gemini as ai_provider when GEMINI_API_KEY is set', async () => {
      const saved = { ...pickAiEnv() };
      clearAiEnv();
      process.env.GEMINI_API_KEY = 'test-gemini-key';

      const res = await request(app).get('/health');
      restoreAiEnv(saved);

      expect(res.body.ai_provider).toBe('gemini');
    });

    it('should report missing as ai_provider when no AI keys are configured', async () => {
      const saved = { ...pickAiEnv() };
      clearAiEnv();

      const res = await request(app).get('/health');
      restoreAiEnv(saved);

      expect(res.body.ai_provider).toBe('missing');
    });

    it('should return 503 when a service is unavailable', async () => {
      vi.spyOn(prisma, '$queryRaw').mockRejectedValueOnce(new Error('DB connection refused'));

      const res = await request(app).get('/health');

      expect(res.status).toBe(503);
      expect(res.body.status).toBe('degraded');
    });
  });
});
