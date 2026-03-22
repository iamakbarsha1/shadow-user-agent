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
      const savedAnth = process.env.ANTHROPIC_API_KEY;
      const savedOR = process.env.OPENROUTER_API_KEY;
      process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
      delete process.env.OPENROUTER_API_KEY;

      const res = await request(app).get('/health');

      if (savedAnth !== undefined) process.env.ANTHROPIC_API_KEY = savedAnth;
      else delete process.env.ANTHROPIC_API_KEY;
      if (savedOR !== undefined) process.env.OPENROUTER_API_KEY = savedOR;

      expect(res.body.ai_provider).toBe('anthropic');
    });

    it('should report openrouter as ai_provider when OPENROUTER_API_KEY is set', async () => {
      const savedOR = process.env.OPENROUTER_API_KEY;
      process.env.OPENROUTER_API_KEY = 'test-openrouter-key';

      const res = await request(app).get('/health');

      if (savedOR !== undefined) process.env.OPENROUTER_API_KEY = savedOR;
      else delete process.env.OPENROUTER_API_KEY;

      expect(res.body.ai_provider).toBe('openrouter');
    });

    it('should report missing as ai_provider when no AI keys are configured', async () => {
      const savedAnth = process.env.ANTHROPIC_API_KEY;
      const savedOR = process.env.OPENROUTER_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.OPENROUTER_API_KEY;

      const res = await request(app).get('/health');

      if (savedAnth !== undefined) process.env.ANTHROPIC_API_KEY = savedAnth;
      if (savedOR !== undefined) process.env.OPENROUTER_API_KEY = savedOR;

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
