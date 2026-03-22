import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted to ensure mocks are available before module initialization
const { mockAdd, mockGetJob, mockClose, mockGetState } = vi.hoisted(() => ({
  mockAdd: vi.fn(),
  mockGetJob: vi.fn(),
  mockClose: vi.fn(),
  mockGetState: vi.fn(),
}));

vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(() => ({
    add: mockAdd,
    getJob: mockGetJob,
    close: mockClose,
  })),
}));

vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { enqueueAgentRun, getJobStatus, closeQueue } from '../queue';

describe('queue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('enqueueAgentRun', () => {
    it('should enqueue a job and return the job ID', async () => {
      mockAdd.mockResolvedValue({ id: 'job-run-001' });

      const jobId = await enqueueAgentRun({
        runId: 'run-001',
        url: 'https://example.com',
        personaId: 'new_user',
      });

      expect(jobId).toBe('job-run-001');
      expect(mockAdd).toHaveBeenCalledWith(
        'execute-agent',
        { runId: 'run-001', url: 'https://example.com', personaId: 'new_user' },
        expect.objectContaining({ jobId: 'run-001' })
      );
    });

    it('should use runId as jobId for idempotency', async () => {
      mockAdd.mockResolvedValue({ id: 'run-idempotent' });

      await enqueueAgentRun({
        runId: 'run-idempotent',
        url: 'https://example.com',
        personaId: 'power_user',
      });

      expect(mockAdd).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({ jobId: 'run-idempotent' })
      );
    });

    it('should pass optional options to the job', async () => {
      mockAdd.mockResolvedValue({ id: 'run-with-opts' });

      await enqueueAgentRun({
        runId: 'run-with-opts',
        url: 'https://example.com',
        personaId: 'edge_case',
        options: {
          maxSteps: 50,
          scopePathPrefix: '/app',
        },
      });

      expect(mockAdd).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          options: { maxSteps: 50, scopePathPrefix: '/app' },
        }),
        expect.any(Object)
      );
    });
  });

  describe('getJobStatus', () => {
    it('should return job state and progress', async () => {
      const mockJob = {
        getState: mockGetState.mockResolvedValue('active'),
        progress: 42,
        returnvalue: null,
        failedReason: undefined,
      };
      mockGetJob.mockResolvedValue(mockJob);

      const status = await getJobStatus('job-001');

      expect(status.state).toBe('active');
      expect(status.progress).toBe(42);
    });

    it('should return progress as undefined when not a number', async () => {
      const mockJob = {
        getState: mockGetState.mockResolvedValue('waiting'),
        progress: {},
        returnvalue: null,
        failedReason: undefined,
      };
      mockGetJob.mockResolvedValue(mockJob);

      const status = await getJobStatus('job-001');

      expect(status.progress).toBeUndefined();
    });

    it('should throw when job is not found', async () => {
      mockGetJob.mockResolvedValue(null);

      await expect(getJobStatus('nonexistent')).rejects.toThrow('Job nonexistent not found');
    });

    it('should return failedReason for failed jobs', async () => {
      const mockJob = {
        getState: mockGetState.mockResolvedValue('failed'),
        progress: 0,
        returnvalue: null,
        failedReason: 'Timed out after 3 minutes',
      };
      mockGetJob.mockResolvedValue(mockJob);

      const status = await getJobStatus('job-failed');

      expect(status.state).toBe('failed');
      expect(status.failedReason).toBe('Timed out after 3 minutes');
    });
  });

  describe('closeQueue', () => {
    it('should close the queue connection', async () => {
      mockClose.mockResolvedValue(undefined);

      await closeQueue();

      expect(mockClose).toHaveBeenCalled();
    });
  });
});
