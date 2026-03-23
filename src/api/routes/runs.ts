import { Router, type Request, type Response, type NextFunction } from 'express';
import { validateRequest, createRunSchema, listRunsQuerySchema } from '../validation';
import { findRunById, listRuns, deleteRun, countActiveRuns } from '../../db/queries/runs';
import { getReportsByRunId } from '../../db/queries/reports';
import { RunNotFoundError, RunLimitExceededError } from '../../utils/errors';
import { validateTargetUrl } from '../../utils/urlValidator';
import { logger } from '../../utils/logger';
import { enqueueAgentRun } from '../../worker/queue';
import { prisma } from '../../db/client';
import { generateReportPDF, type BugReportContent, type CodeReviewContent } from '../../utils/pdfGenerator';
import type {
  CreateRunRequest,
  CreateRunResponse,
  GetRunResponse,
  ListRunsResponse,
} from '../../types/run';

const router = Router();

/**
 * POST /api/v1/runs
 * Create a new agent run
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = validateRequest(createRunSchema, req.body) as CreateRunRequest;

    // SSRF protection — validate URL before doing anything else
    validateTargetUrl(body.url);

    // Check for concurrent run limit (max 3 active runs)
    const activeRuns = await countActiveRuns();
    if (activeRuns >= parseInt(process.env.AGENT_MAX_CONCURRENCY || '3', 10)) {
      throw new RunLimitExceededError();
    }

    // Use explicit transaction to ensure write is committed before job is enqueued
    // This prevents race conditions where worker reads before commit
    const run = await prisma.$transaction(async (tx) => {
      const newRun = await tx.run.create({
        data: {
          url: body.url,
          personaId: body.personaId,
          status: 'pending',
        },
      });

      // Read it back within transaction to ensure it exists
      const verified = await tx.run.findUnique({
        where: { id: newRun.id },
      });

      if (!verified) {
        throw new Error('Run verification failed - created run not found');
      }

      return newRun;
    });

    logger.info(
      {
        runId: run.id,
        url: body.url,
        personaId: body.personaId,
        userId: req.user?.userId,
      },
      'Run created'
    );

    // Enqueue agent run job
    await enqueueAgentRun({
      runId: run.id,
      url: body.url,
      personaId: body.personaId,
      options: body.options,
    });

    const response: CreateRunResponse = {
      runId: run.id,
      status: run.status as 'pending',
      startedAt: run.startedAt.toISOString(),
    };

    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/runs/:runId
 * Get a specific run by ID
 */
router.get('/:runId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const runId = String(req.params['runId']);

    const run = await findRunById(runId);
    if (!run) {
      throw new RunNotFoundError(runId);
    }

    const response: GetRunResponse = {
      runId: run.id,
      url: run.url,
      personaId: run.personaId,
      status: run.status as 'pending' | 'running' | 'complete' | 'failed',
      startedAt: run.startedAt.toISOString(),
      completedAt: run.completedAt?.toISOString(),
      observationCount: run.observations.length,
      reportIds: run.reports.map((r) => r.id),
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/runs
 * List runs with optional filtering and pagination
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = validateRequest(listRunsQuerySchema, req.query);

    const { runs, total } = await listRuns({
      status: query.status,
      limit: query.limit,
      offset: query.offset,
    });

    const response: ListRunsResponse = {
      runs: runs.map((r) => ({
        runId: r.id,
        url: r.url,
        personaId: r.personaId,
        status: r.status as 'pending' | 'running' | 'complete' | 'failed',
        startedAt: r.startedAt.toISOString(),
        completedAt: r.completedAt?.toISOString(),
      })),
      total,
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/runs/:runId/reports
 * List all reports for a run
 */
router.get('/:runId/reports', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const runId = String(req.params['runId']);

    const run = await findRunById(runId);
    if (!run) {
      throw new RunNotFoundError(runId);
    }

    const reports = await getReportsByRunId(runId);

    res.status(200).json({
      runId,
      reports: reports.map((r) => ({
        reportId: r.id,
        reportType: r.reportType,
        content: r.content,
        createdAt: r.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/runs/:runId/reports/pdf
 * Export reports as PDF
 */
router.get('/:runId/reports/pdf', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const runId = String(req.params['runId']);

    const run = await findRunById(runId);
    if (!run) {
      throw new RunNotFoundError(runId);
    }

    const reports = await getReportsByRunId(runId);
    const bugReport = reports.find((r) => r.reportType === 'bug_report');
    const codeReview = reports.find((r) => r.reportType === 'code_review');

    const pdfBuffer = await generateReportPDF(
      {
        runId: run.id,
        url: run.url,
        personaId: run.personaId,
        status: run.status,
        startedAt: run.startedAt.toISOString(),
        completedAt: run.completedAt?.toISOString(),
        observationCount: run.observations.length,
      },
      bugReport?.content as unknown as BugReportContent | undefined,
      codeReview?.content as unknown as CodeReviewContent | undefined
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="shadow-report-${runId.slice(0, 8)}.pdf"`
    );
    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/v1/runs/:runId
 * Delete a run and all associated data
 */
router.delete('/:runId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const runId = String(req.params['runId']);

    // Check if run exists
    const run = await findRunById(runId);
    if (!run) {
      throw new RunNotFoundError(runId);
    }

    // Delete the run (cascades to observations, reports, screenshots)
    await deleteRun(runId);

    logger.info({ runId, userId: req.user?.userId }, 'Run deleted');

    res.status(200).json({ deleted: true });
  } catch (error) {
    next(error);
  }
});

export default router;
