import { vi, describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import jwt from 'jsonwebtoken';

// In-memory run store for mock
let runStore: Map<string, Record<string, unknown>>;

// Mock queue — must be before imports that use it
vi.mock('../../worker/queue', () => ({
  enqueueAgentRun: vi.fn().mockResolvedValue('mock-job-id'),
  getJobStatus: vi.fn(),
  closeQueue: vi.fn(),
}));

// Mock ioredis - must provide call method for rate-limit-redis
vi.mock('ioredis', () => {
  const RedisMock = vi.fn().mockImplementation(() => ({
    ping: vi.fn().mockResolvedValue('PONG'),
    disconnect: vi.fn(),
    quit: vi.fn(),
    on: vi.fn(),
    // rate-limit-redis expects array responses for script commands
    call: vi.fn().mockImplementation(async (command: string, ...args: string[]) => {
      if (command === 'EVAL' || command === 'EVALSHA') {
        return [0, 0]; // [timestamp, hits] format expected by rate-limit-redis
      }
      if (command === 'SCRIPT' && args[0] === 'EXISTS') {
        return [0]; // Script doesn't exist, will trigger EVAL
      }
      return 'OK';
    }),
    connect: vi.fn().mockResolvedValue(undefined),
  }));
  return { default: RedisMock };
});

// Mock prisma client
vi.mock('../../db/client', () => {
  const createMockPrisma = () => ({
    run: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(),
    $disconnect: vi.fn(),
    $queryRaw: vi.fn(),
  });
  return { prisma: createMockPrisma() };
});

import { createApp } from '../app';
import { prisma } from '../../db/client';

// Type helper for mocked prisma
const mockPrisma = prisma as unknown as {
  run: {
    create: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    deleteMany: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
  $disconnect: ReturnType<typeof vi.fn>;
  $queryRaw: ReturnType<typeof vi.fn>;
};

function createMockRun(overrides: Record<string, unknown> = {}) {
  const id = overrides.id as string || `run-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  return {
    id,
    url: 'https://example.com',
    personaId: 'new_user',
    status: 'pending',
    startedAt: new Date(),
    completedAt: null,
    errorMessage: null,
    observations: [],
    reports: [],
    ...overrides,
  };
}

describe('Runs API', () => {
  let app: Express;
  let testToken: string;

  beforeAll(async () => {
    app = createApp();

    const privateKey = process.env.JWT_PRIVATE_KEY!;
    testToken = jwt.sign(
      { userId: 'test-user', email: 'test@example.com' },
      privateKey,
      { algorithm: 'RS256', expiresIn: '1h' }
    );
  });

  beforeEach(() => {
    vi.clearAllMocks();
    runStore = new Map();

    // Default: no active runs
    mockPrisma.run.count.mockResolvedValue(0);

    // $transaction calls the callback with a tx proxy that delegates to the same mock
    mockPrisma.$transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
      const txProxy = {
        run: {
          create: vi.fn().mockImplementation(async (args: { data: Record<string, unknown> }) => {
            const run = createMockRun({ url: args.data.url, personaId: args.data.personaId });
            runStore.set(run.id, run);
            return run;
          }),
          findUnique: vi.fn().mockImplementation(async (args: { where: { id: string } }) => {
            return runStore.get(args.where.id) || null;
          }),
        },
      };
      return cb(txProxy);
    });

    // findRunById uses prisma.run.findUnique with includes
    mockPrisma.run.findUnique.mockImplementation(async (args: { where: { id: string } }) => {
      return runStore.get(args.where.id) || null;
    });

    // listRuns
    mockPrisma.run.findMany.mockImplementation(async () => {
      return Array.from(runStore.values());
    });

    // deleteRun
    mockPrisma.run.delete.mockImplementation(async (args: { where: { id: string } }) => {
      const run = runStore.get(args.where.id);
      runStore.delete(args.where.id);
      return run;
    });

    // deleteMany for cleanup
    mockPrisma.run.deleteMany.mockResolvedValue({ count: 0 });
  });

  describe('POST /api/v1/runs', () => {
    it('should create a new run with valid input', async () => {
      const res = await request(app)
        .post('/api/v1/runs')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          url: 'https://demo.playwright.dev/todomvc',
          personaId: 'new_user',
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('runId');
      expect(res.body.status).toBe('pending');
      expect(res.body).toHaveProperty('startedAt');
    });

    it('should return 400 for invalid URL', async () => {
      const res = await request(app)
        .post('/api/v1/runs')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          url: 'not-a-valid-url',
          personaId: 'new_user',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for unknown persona', async () => {
      const res = await request(app)
        .post('/api/v1/runs')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          url: 'https://example.com',
          personaId: 'invalid_persona',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 401 without auth token', async () => {
      const res = await request(app).post('/api/v1/runs').send({
        url: 'https://example.com',
        personaId: 'new_user',
      });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should accept optional maxSteps parameter', async () => {
      const res = await request(app)
        .post('/api/v1/runs')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          url: 'https://example.com',
          personaId: 'power_user',
          options: {
            maxSteps: 50,
          },
        });

      expect(res.status).toBe(201);
    });
  });

  describe('GET /api/v1/runs/:runId', () => {
    it('should return run details for valid runId', async () => {
      // Create a run first
      const createRes = await request(app)
        .post('/api/v1/runs')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          url: 'https://example.com',
          personaId: 'new_user',
        });

      const runId = createRes.body.runId;

      const res = await request(app)
        .get(`/api/v1/runs/${runId}`)
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.status).toBe(200);
      expect(res.body.runId).toBe(runId);
      expect(res.body.url).toBe('https://example.com');
      expect(res.body.personaId).toBe('new_user');
      expect(res.body.status).toBe('pending');
      expect(res.body.observationCount).toBe(0);
      expect(res.body.reportIds).toEqual([]);
    });

    it('should return 404 for non-existent runId', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const res = await request(app)
        .get(`/api/v1/runs/${fakeId}`)
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('RUN_NOT_FOUND');
    });
  });

  describe('GET /api/v1/runs', () => {
    it('should return empty list when no runs exist', async () => {
      // Override count to return 0 for list query
      mockPrisma.run.count.mockResolvedValue(0);

      const res = await request(app)
        .get('/api/v1/runs')
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.status).toBe(200);
      expect(res.body.runs).toEqual([]);
      expect(res.body.total).toBe(0);
      expect(res.body.limit).toBe(20);
      expect(res.body.offset).toBe(0);
    });

    it('should return list of runs', async () => {
      // Create multiple runs
      await request(app)
        .post('/api/v1/runs')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ url: 'https://example.com', personaId: 'new_user' });

      await request(app)
        .post('/api/v1/runs')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ url: 'https://test.com', personaId: 'power_user' });

      // Update count mock to reflect stored runs
      mockPrisma.run.count.mockResolvedValue(runStore.size);

      const res = await request(app)
        .get('/api/v1/runs')
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.status).toBe(200);
      expect(res.body.runs).toHaveLength(2);
      expect(res.body.total).toBe(2);
    });

    it('should support pagination with limit and offset', async () => {
      // Create 3 runs
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/api/v1/runs')
          .set('Authorization', `Bearer ${testToken}`)
          .send({ url: 'https://example.com', personaId: 'new_user' });
      }

      const allRuns = Array.from(runStore.values());

      // Page 1: limit=2, offset=0
      mockPrisma.run.findMany.mockResolvedValueOnce(allRuns.slice(0, 2));
      mockPrisma.run.count.mockResolvedValueOnce(3);

      const res1 = await request(app)
        .get('/api/v1/runs?limit=2&offset=0')
        .set('Authorization', `Bearer ${testToken}`);

      expect(res1.body.runs).toHaveLength(2);
      expect(res1.body.limit).toBe(2);
      expect(res1.body.offset).toBe(0);

      // Page 2: limit=2, offset=2
      mockPrisma.run.findMany.mockResolvedValueOnce(allRuns.slice(2));
      mockPrisma.run.count.mockResolvedValueOnce(3);

      const res2 = await request(app)
        .get('/api/v1/runs?limit=2&offset=2')
        .set('Authorization', `Bearer ${testToken}`);

      expect(res2.body.runs).toHaveLength(1);
      expect(res2.body.limit).toBe(2);
      expect(res2.body.offset).toBe(2);
    });

    it('should filter by status', async () => {
      mockPrisma.run.findMany.mockResolvedValue([]);
      mockPrisma.run.count.mockResolvedValue(0);

      const res = await request(app)
        .get('/api/v1/runs?status=pending')
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.status).toBe(200);
    });
  });

  describe('DELETE /api/v1/runs/:runId', () => {
    it('should delete an existing run', async () => {
      // Create a run
      const createRes = await request(app)
        .post('/api/v1/runs')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ url: 'https://example.com', personaId: 'new_user' });

      const runId = createRes.body.runId;

      const deleteRes = await request(app)
        .delete(`/api/v1/runs/${runId}`)
        .set('Authorization', `Bearer ${testToken}`);

      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.deleted).toBe(true);

      // Verify it's deleted
      const getRes = await request(app)
        .get(`/api/v1/runs/${runId}`)
        .set('Authorization', `Bearer ${testToken}`);

      expect(getRes.status).toBe(404);
    });

    it('should return 404 when deleting non-existent run', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const res = await request(app)
        .delete(`/api/v1/runs/${fakeId}`)
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('RUN_NOT_FOUND');
    });
  });
});
