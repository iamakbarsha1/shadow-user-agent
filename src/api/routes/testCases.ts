import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { validateRequest } from '../validation';
import {
  findTestCaseById,
  listTestCasesByRunId,
  updateTestCase,
  deleteTestCase,
} from '../../db/queries/testCases';
import {
  createTestExecution,
  listExecutionsByTestCaseId,
  countExecutionsByTestCaseId,
} from '../../db/queries/testExecutions';
import { findRunById } from '../../db/queries/runs';
import { RunNotFoundError, TestCaseNotFoundError } from '../../utils/errors';
import { logger } from '../../utils/logger';
import { runTestCode } from '../../worker/testExecutor';
import { diagnoseFailure } from '../../ai/failureDiagnoser';
import { healSelectors } from '../../ai/selectorHealer';
import type {
  ListTestCasesResponse,
  GetTestCaseResponse,
  UpdateTestCaseRequest,
} from '../../types/testCase';
import type {
  ExecuteTestCaseResponse,
  ListTestExecutionsResponse,
  FailureDiagnosis,
} from '../../types/testExecution';

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
 * POST /api/v1/test-cases/:id/execute
 * Run the test case. On failure, attempt AI-powered selector healing.
 * Returns execution result and saves a TestExecution record.
 */
router.post('/:id/execute', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params['id']);
    const tc = await findTestCaseById(id);
    if (!tc) throw new TestCaseNotFoundError(id);

    logger.info({ id, userId: req.user?.userId }, 'Executing test case');

    // Step 1: Run the test
    const result = await runTestCode(tc.testCode);

    let finalStatus: string;
    let diagnosis: FailureDiagnosis | null = null;
    let healedCode: string | undefined;
    let healConfirmed = false;

    if (result.passed) {
      finalStatus = 'passed';
    } else {
      // Step 2: Diagnose the failure
      diagnosis = await diagnoseFailure(tc.testCode, result.output);

      // Step 3: Attempt selector healing
      const selectorMap = (tc.selectorMap as Record<string, string> | null) ?? {};
      let healResult = null;

      if (diagnosis) {
        healResult = await healSelectors(tc.testCode, selectorMap, diagnosis, result.output);
      }

      if (healResult) {
        // Step 4: Re-run with healed code to confirm
        const healedResult = await runTestCode(healResult.healedCode);

        if (healedResult.passed) {
          healedCode = healResult.healedCode;
          healConfirmed = true;
          finalStatus = 'healed';

          // Persist the healed code back to the TestCase
          await updateTestCase(id, {
            testCode: healResult.healedCode,
            selectorMap: healResult.updatedSelectorMap,
            status: 'passing',
            lastRunAt: new Date(),
            lastResult: { passed: true, duration: healedResult.duration },
          });
        } else {
          finalStatus = 'failed';
        }
      } else {
        finalStatus = 'failed';
      }

      if (!healConfirmed) {
        await updateTestCase(id, {
          status: 'failing',
          lastRunAt: new Date(),
          lastResult: { passed: false, duration: result.duration, output: result.output.slice(0, 500) },
        });
      }
    }

    if (result.passed) {
      await updateTestCase(id, {
        status: 'passing',
        lastRunAt: new Date(),
        lastResult: { passed: true, duration: result.duration },
      });
    }

    // Persist execution record
    const execution = await createTestExecution({
      testCaseId: id,
      status: finalStatus,
      duration: result.duration,
      output: result.output,
      diagnosis: diagnosis ?? undefined,
      healedCode,
    });

    logger.info({ id, status: finalStatus, executionId: execution.id }, 'Test execution complete');

    const response: ExecuteTestCaseResponse = {
      executionId: execution.id,
      status: finalStatus as ExecuteTestCaseResponse['status'],
      duration: result.duration,
      output: result.output,
      diagnosis,
      healed: healConfirmed,
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/test-cases/:id/executions
 * List execution history for a test case
 */
router.get('/:id/executions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params['id']);
    const tc = await findTestCaseById(id);
    if (!tc) throw new TestCaseNotFoundError(id);

    const executions = await listExecutionsByTestCaseId(id);
    const total = await countExecutionsByTestCaseId(id);

    const response: ListTestExecutionsResponse = {
      testCaseId: id,
      executions: executions.map((e) => ({
        id: e.id,
        testCaseId: e.testCaseId,
        status: e.status as 'passed' | 'failed' | 'healed' | 'error',
        duration: e.duration,
        output: e.output,
        diagnosis: (e.diagnosis as FailureDiagnosis | null) ?? null,
        healedCode: e.healedCode,
        executedAt: e.executedAt.toISOString(),
      })),
      total,
    };

    res.status(200).json(response);
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
