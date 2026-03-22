import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    run: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    report: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    observation: {
      createMany: vi.fn(),
      findMany: vi.fn(),
    },
    $executeRaw: vi.fn(),
  },
}));

vi.mock('../client', () => ({ prisma: mockPrisma }));

import {
  createRun,
  findRunById,
  listRuns,
  updateRunStatus,
  deleteRun,
  countActiveRuns,
} from '../queries/runs';
import { saveReport, getReportsByRunId, findReportById } from '../queries/reports';
import { saveObservations } from '../queries/observations';
import type { Observation } from '../../types/observation';

describe('runs queries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('createRun — creates a run with pending status', async () => {
    const mockRun = { id: 'run-001', url: 'https://example.com', personaId: 'new_user', status: 'pending' };
    mockPrisma.run.create.mockResolvedValue(mockRun);

    const result = await createRun({ url: 'https://example.com', personaId: 'new_user' });

    expect(result).toEqual(mockRun);
    expect(mockPrisma.run.create).toHaveBeenCalledWith({
      data: { url: 'https://example.com', personaId: 'new_user', status: 'pending' },
    });
  });

  it('findRunById — returns run with observations and reports', async () => {
    const mockRun = { id: 'run-001', observations: [], reports: [] };
    mockPrisma.run.findUnique.mockResolvedValue(mockRun);

    const result = await findRunById('run-001');

    expect(result).toEqual(mockRun);
    expect(mockPrisma.run.findUnique).toHaveBeenCalledWith({
      where: { id: 'run-001' },
      include: { observations: true, reports: true },
    });
  });

  it('listRuns — returns paginated runs with total', async () => {
    mockPrisma.run.findMany.mockResolvedValue([{ id: 'run-001' }]);
    mockPrisma.run.count.mockResolvedValue(1);

    const result = await listRuns({ limit: 10, offset: 0 });

    expect(result.runs).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it('listRuns — filters by status when provided', async () => {
    mockPrisma.run.findMany.mockResolvedValue([]);
    mockPrisma.run.count.mockResolvedValue(0);

    await listRuns({ status: 'running' });

    expect(mockPrisma.run.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'running' } })
    );
  });

  it('listRuns — caps limit at 100', async () => {
    mockPrisma.run.findMany.mockResolvedValue([]);
    mockPrisma.run.count.mockResolvedValue(0);

    await listRuns({ limit: 999 });

    expect(mockPrisma.run.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 })
    );
  });

  it('updateRunStatus — sets completedAt for complete status', async () => {
    mockPrisma.run.update.mockResolvedValue({ id: 'run-001', status: 'complete' });

    await updateRunStatus('run-001', 'complete');

    expect(mockPrisma.run.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'complete', completedAt: expect.any(Date) }),
      })
    );
  });

  it('updateRunStatus — sets completedAt for failed status', async () => {
    mockPrisma.run.update.mockResolvedValue({ id: 'run-001', status: 'failed' });

    await updateRunStatus('run-001', 'failed', 'Timed out');

    expect(mockPrisma.run.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ errorMessage: 'Timed out' }),
      })
    );
  });

  it('updateRunStatus — re-throws P2025 with descriptive message', async () => {
    const prismaError = Object.assign(new Error('Record not found'), { code: 'P2025' });
    mockPrisma.run.update.mockRejectedValue(prismaError);

    await expect(updateRunStatus('bad-id', 'running')).rejects.toThrow('[P2025]');
  });

  it('updateRunStatus — re-throws unknown errors', async () => {
    mockPrisma.run.update.mockRejectedValue(new Error('Database connection lost'));

    await expect(updateRunStatus('run-001', 'running')).rejects.toThrow('Database connection lost');
  });

  it('deleteRun — deletes by ID', async () => {
    mockPrisma.run.delete.mockResolvedValue({ id: 'run-001' });

    await deleteRun('run-001');

    expect(mockPrisma.run.delete).toHaveBeenCalledWith({ where: { id: 'run-001' } });
  });

  it('countActiveRuns — counts pending and running runs', async () => {
    mockPrisma.run.count.mockResolvedValue(3);

    const count = await countActiveRuns();

    expect(count).toBe(3);
    expect(mockPrisma.run.count).toHaveBeenCalledWith({
      where: { status: { in: ['pending', 'running'] } },
    });
  });
});

describe('reports queries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('saveReport — creates a report and returns the ID', async () => {
    mockPrisma.report.create.mockResolvedValue({ id: 'report-001' });

    const id = await saveReport('run-001', 'bug_report', { bugs: [] });

    expect(id).toBe('report-001');
    expect(mockPrisma.report.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ runId: 'run-001', reportType: 'bug_report' }),
    });
  });

  it('getReportsByRunId — returns all reports for a run', async () => {
    mockPrisma.report.findMany.mockResolvedValue([{ id: 'report-001' }, { id: 'report-002' }]);

    const reports = await getReportsByRunId('run-001');

    expect(reports).toHaveLength(2);
    expect(mockPrisma.report.findMany).toHaveBeenCalledWith({
      where: { runId: 'run-001' },
      orderBy: { createdAt: 'asc' },
    });
  });

  it('findReportById — returns a report by ID', async () => {
    mockPrisma.report.findUnique.mockResolvedValue({ id: 'report-001', reportType: 'bug_report' });

    const report = await findReportById('report-001');

    expect(report?.id).toBe('report-001');
  });

  it('findReportById — returns null for missing report', async () => {
    mockPrisma.report.findUnique.mockResolvedValue(null);

    const report = await findReportById('nonexistent');

    expect(report).toBeNull();
  });
});

describe('observations queries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockObservations: Observation[] = [
    {
      id: 'obs-001',
      eventType: 'console_error',
      timestamp: '2026-01-01T00:00:10Z',
      payload: { message: 'Error', url: 'https://example.com' },
    },
    {
      id: 'obs-002',
      eventType: 'network_failure',
      timestamp: '2026-01-01T00:00:20Z',
      payload: { url: 'https://example.com/api', statusCode: 404, responseTime: 50, method: 'GET' },
      screenshotPath: '/tmp/screenshot.png',
    },
  ];

  it('saveObservations — creates many observations in db', async () => {
    mockPrisma.observation.createMany.mockResolvedValue({ count: 2 });
    mockPrisma.$executeRaw.mockResolvedValue(1);

    await saveObservations('run-001', mockObservations);

    expect(mockPrisma.observation.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ runId: 'run-001', eventType: 'console_error' }),
      ]),
    });
  });

  it('saveObservations — does nothing for empty array', async () => {
    await saveObservations('run-001', []);

    expect(mockPrisma.observation.createMany).not.toHaveBeenCalled();
  });

  it('saveObservations — saves screenshot for observations that have one', async () => {
    mockPrisma.observation.createMany.mockResolvedValue({ count: 2 });
    mockPrisma.$executeRaw.mockResolvedValue(1);

    await saveObservations('run-001', mockObservations);

    // Should attempt to save the screenshot for obs-002 which has screenshotPath
    expect(mockPrisma.$executeRaw).toHaveBeenCalled();
  });

  it('saveObservations — skips executeRaw when no observations have screenshots', async () => {
    const obsWithoutScreenshots: Observation[] = [
      {
        id: 'obs-001',
        eventType: 'console_error',
        timestamp: '2026-01-01T00:00:10Z',
        payload: { message: 'Error', url: 'https://example.com' },
      },
    ];
    mockPrisma.observation.createMany.mockResolvedValue({ count: 1 });

    await saveObservations('run-001', obsWithoutScreenshots);

    expect(mockPrisma.$executeRaw).not.toHaveBeenCalled();
  });
});
