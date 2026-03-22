import { vi, describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import jwt from 'jsonwebtoken';

// Mock queue
vi.mock('../../worker/queue', () => ({
  enqueueAgentRun: vi.fn().mockResolvedValue('mock-job-id'),
  getJobStatus: vi.fn(),
  closeQueue: vi.fn(),
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

const mockReports = [
  {
    id: 'report-001',
    runId: 'run-001',
    reportType: 'bug_report',
    content: {
      sessionSummary: 'Test session',
      bugs: [],
      uxFrictionPoints: [],
    },
    createdAt: new Date('2026-01-01'),
  },
  {
    id: 'report-002',
    runId: 'run-001',
    reportType: 'code_review',
    content: {
      overallAssessment: 'Good',
      criticalIssues: [],
      improvements: [],
      positives: ['Clean code'],
      recommendations: [],
    },
    createdAt: new Date('2026-01-01'),
  },
];

const mockRun = {
  id: 'run-001',
  url: 'https://example.com',
  personaId: 'new_user',
  status: 'complete',
  startedAt: new Date(),
  completedAt: new Date(),
  observations: [],
  reports: mockReports,
};

// Mock prisma
vi.mock('../../db/client', () => ({
  prisma: {
    run: {
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    report: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
    $disconnect: vi.fn(),
    $queryRaw: vi.fn(),
  },
}));

import { createApp } from '../app';
import { prisma } from '../../db/client';

const mockPrisma = prisma as unknown as {
  run: { findUnique: ReturnType<typeof vi.fn> };
  report: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
};

describe('Reports API', () => {
  let app: Express;
  let testToken: string;

  beforeAll(() => {
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
  });

  describe('GET /api/v1/runs/:runId/reports', () => {
    it('should return reports for a valid run', async () => {
      mockPrisma.run.findUnique.mockResolvedValue(mockRun);
      mockPrisma.report.findMany.mockResolvedValue(mockReports);

      const res = await request(app)
        .get('/api/v1/runs/run-001/reports')
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.status).toBe(200);
      expect(res.body.runId).toBe('run-001');
      expect(res.body.reports).toHaveLength(2);
      expect(res.body.reports[0].reportType).toBe('bug_report');
      expect(res.body.reports[1].reportType).toBe('code_review');
    });

    it('should return 404 for non-existent run', async () => {
      mockPrisma.run.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .get('/api/v1/runs/nonexistent/reports')
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('RUN_NOT_FOUND');
    });

    it('should require authentication', async () => {
      const res = await request(app).get('/api/v1/runs/run-001/reports');

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/reports/:reportId', () => {
    it('should return a single report', async () => {
      mockPrisma.report.findUnique.mockResolvedValue(mockReports[0]);

      const res = await request(app)
        .get('/api/v1/reports/report-001')
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.status).toBe(200);
      expect(res.body.reportId).toBe('report-001');
      expect(res.body.reportType).toBe('bug_report');
      expect(res.body.content).toHaveProperty('sessionSummary');
    });

    it('should return 404 for non-existent report', async () => {
      mockPrisma.report.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .get('/api/v1/reports/nonexistent')
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('REPORT_NOT_FOUND');
    });

    it('should require authentication', async () => {
      const res = await request(app).get('/api/v1/reports/report-001');

      expect(res.status).toBe(401);
    });
  });
});
