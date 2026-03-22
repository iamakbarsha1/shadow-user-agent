import { vi, describe, it, expect, beforeAll } from 'vitest';
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

describe('Health API', () => {
  let app: Express;

  beforeAll(() => {
    app = createApp();
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
  });
});
