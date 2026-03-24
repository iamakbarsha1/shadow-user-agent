import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { validateRequest } from '../validation';
import {
  findTestCaseById,
  listTestCasesByRunId,
  updateTestCase,
  deleteTestCase,
} from '../../db/queries/testCases';
import { findRunById } from '../../db/queries/runs';
import { RunNotFoundError, TestCaseNotFoundError } from '../../utils/errors';
import { logger } from '../../utils/logger';
import type {
  ListTestCasesResponse,
  GetTestCaseResponse,
  UpdateTestCaseRequest,
} from '../../types/testCase';

const router = Router();

const updateTestCaseSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  testCode: z.string().min(1).optional(),
});

/**
 * GET /api/v1/runs/:runId/test-cases
 * List all generated test cases for a run
 */
router.get('/runs/:runId/test-cases', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const runId = String(req.params['runId']);
    const run = await findRunById(runId);
    if (!run) throw new RunNotFoundError(runId);

    const testCases = await listTestCasesByRunId(runId);

    const response: ListTestCasesResponse = {
      runId,
      testCases: testCases.map((tc) => ({
        id: tc.id,
        runId: tc.runId,
        title: tc.title,
        description: tc.description ?? undefined,
        testCode: tc.testCode,
        framework: tc.framework as 'playwright' | 'cypress',
        status: tc.status as 'generated' | 'passing' | 'failing' | 'stale',
        lastRunAt: tc.lastRunAt?.toISOString(),
        lastResult: (tc.lastResult as Record<string, unknown> | null) ?? undefined,
        selectorMap: (tc.selectorMap as Record<string, string> | null) ?? undefined,
        createdAt: tc.createdAt.toISOString(),
        updatedAt: tc.updatedAt.toISOString(),
      })),
      total: testCases.length,
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/test-cases/:id
 * Get a single test case with its code
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params['id']);
    const tc = await findTestCaseById(id);
    if (!tc) throw new TestCaseNotFoundError(id);

    const response: GetTestCaseResponse = {
      id: tc.id,
      runId: tc.runId,
      title: tc.title,
      description: tc.description ?? undefined,
      testCode: tc.testCode,
      framework: tc.framework as 'playwright' | 'cypress',
      status: tc.status as 'generated' | 'passing' | 'failing' | 'stale',
      lastRunAt: tc.lastRunAt?.toISOString(),
      lastResult: (tc.lastResult as Record<string, unknown> | null) ?? undefined,
      selectorMap: (tc.selectorMap as Record<string, string> | null) ?? undefined,
      createdAt: tc.createdAt.toISOString(),
      updatedAt: tc.updatedAt.toISOString(),
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/v1/test-cases/:id
 * Update a test case (user edits to title, description, or code)
 */
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params['id']);
    const body = validateRequest(updateTestCaseSchema, req.body) as UpdateTestCaseRequest;

    const existing = await findTestCaseById(id);
    if (!existing) throw new TestCaseNotFoundError(id);

    const updated = await updateTestCase(id, {
      title: body.title,
      description: body.description,
      testCode: body.testCode,
    });

    logger.info({ id, userId: req.user?.userId }, 'Test case updated');

    res.status(200).json({
      id: updated.id,
      runId: updated.runId,
      title: updated.title,
      description: updated.description ?? undefined,
      testCode: updated.testCode,
      framework: updated.framework,
      status: updated.status,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/v1/test-cases/:id
 * Delete a test case
 */
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params['id']);

    const existing = await findTestCaseById(id);
    if (!existing) throw new TestCaseNotFoundError(id);

    await deleteTestCase(id);

    logger.info({ id, userId: req.user?.userId }, 'Test case deleted');

    res.status(200).json({ deleted: true });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/test-cases/:id/download
 * Download test case as a .spec.ts file
 */
router.get('/:id/download', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params['id']);
    const tc = await findTestCaseById(id);
    if (!tc) throw new TestCaseNotFoundError(id);

    const filename = `${tc.title.toLowerCase().replace(/\s+/g, '-')}.spec.ts`;

    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(tc.testCode);
  } catch (error) {
    next(error);
  }
});

export default router;
