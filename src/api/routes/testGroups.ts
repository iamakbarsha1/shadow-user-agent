import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { validateRequest } from '../validation';
import {
  createTestGroup,
  findTestGroupById,
  listTestGroups,
  updateTestGroup,
  deleteTestGroup,
  addMemberToGroup,
  removeMemberFromGroup,
  listGroupMembers,
} from '../../db/queries/testGroups';
import { findTestCaseById, updateTestCase } from '../../db/queries/testCases';
import { createTestExecution } from '../../db/queries/testExecutions';
import { TestGroupNotFoundError, TestCaseNotFoundError } from '../../utils/errors';
import { logger } from '../../utils/logger';
import { runTestCode } from '../../worker/testExecutor';
import { diagnoseFailure } from '../../ai/failureDiagnoser';
import { healSelectors } from '../../ai/selectorHealer';
import type {
  ListTestGroupsResponse,
  GetTestGroupResponse,
  GroupExecutionResult,
  MemberExecutionResult,
} from '../../types/testGroup';
import type { FailureDiagnosis } from '../../types/testExecution';

const router = Router();

const createTestGroupSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  runOnSchedule: z.boolean().optional(),
});

const updateTestGroupSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  runOnSchedule: z.boolean().optional(),
});

const addMemberSchema = z.object({
  testCaseId: z.string().uuid(),
  order: z.number().int().min(0).optional(),
});

function formatGroup(group: Awaited<ReturnType<typeof findTestGroupById>>): GetTestGroupResponse {
  if (!group) throw new Error('group is null');
  return {
    id: group.id,
    name: group.name,
    description: group.description ?? undefined,
    runOnSchedule: group.runOnSchedule,
    createdAt: group.createdAt.toISOString(),
    updatedAt: group.updatedAt.toISOString(),
    memberships: group.memberships.map((m) => ({
      id: m.id,
      testGroupId: m.testGroupId,
      testCaseId: m.testCaseId,
      order: m.order,
      testCase: {
        id: m.testCase.id,
        title: m.testCase.title,
        status: m.testCase.status,
        framework: m.testCase.framework,
      },
    })),
  };
}

/**
 * GET /api/v1/test-groups
 * List all test groups
 */
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const groups = await listTestGroups();

    const response: ListTestGroupsResponse = {
      testGroups: groups.map((g) => formatGroup(g)),
      total: groups.length,
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/test-groups
 * Create a new test group
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = validateRequest(createTestGroupSchema, req.body);
    const group = await createTestGroup(body);

    logger.info({ groupId: group.id, userId: req.user?.userId }, 'Test group created');

    res.status(201).json(formatGroup(group));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/test-groups/:id
 * Get a single test group with its members
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params['id']);
    const group = await findTestGroupById(id);
    if (!group) throw new TestGroupNotFoundError(id);

    res.status(200).json(formatGroup(group));
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/v1/test-groups/:id
 * Update a test group
 */
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params['id']);
    const body = validateRequest(updateTestGroupSchema, req.body);

    const existing = await findTestGroupById(id);
    if (!existing) throw new TestGroupNotFoundError(id);

    const updated = await updateTestGroup(id, body);

    logger.info({ groupId: id, userId: req.user?.userId }, 'Test group updated');

    res.status(200).json(formatGroup(updated));
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/v1/test-groups/:id
 * Delete a test group
 */
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params['id']);

    const existing = await findTestGroupById(id);
    if (!existing) throw new TestGroupNotFoundError(id);

    await deleteTestGroup(id);

    logger.info({ groupId: id, userId: req.user?.userId }, 'Test group deleted');

    res.status(200).json({ deleted: true });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/test-groups/:id/members
 * Add a test case to the group
 */
router.post('/:id/members', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params['id']);
    const body = validateRequest(addMemberSchema, req.body);

    const group = await findTestGroupById(id);
    if (!group) throw new TestGroupNotFoundError(id);

    const tc = await findTestCaseById(body.testCaseId);
    if (!tc) throw new TestCaseNotFoundError(body.testCaseId);

    const nextOrder = body.order ?? group.memberships.length;
    await addMemberToGroup(id, body.testCaseId, nextOrder);

    const updated = await findTestGroupById(id);
    res.status(200).json(formatGroup(updated!));
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/v1/test-groups/:id/members/:testCaseId
 * Remove a test case from the group
 */
router.delete('/:id/members/:testCaseId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params['id']);
    const testCaseId = String(req.params['testCaseId']);

    const group = await findTestGroupById(id);
    if (!group) throw new TestGroupNotFoundError(id);

    const members = await listGroupMembers(id);
    const isMember = members.some((m) => m.testCaseId === testCaseId);
    if (!isMember) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Test case is not a member of this group', details: {} } });
      return;
    }

    await removeMemberFromGroup(id, testCaseId);

    const updated = await findTestGroupById(id);
    res.status(200).json(formatGroup(updated!));
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/test-groups/:id/execute
 * Run all member test cases sequentially (with auto-healing)
 */
router.post('/:id/execute', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params['id']);
    const group = await findTestGroupById(id);
    if (!group) throw new TestGroupNotFoundError(id);

    const members = group.memberships;

    logger.info({ groupId: id, memberCount: members.length, userId: req.user?.userId }, 'Executing test group');

    const results: MemberExecutionResult[] = [];

    for (const member of members) {
      const tc = member.testCase;

      const result = await runTestCode(tc.testCode);

      let finalStatus: string;
      let diagnosis: FailureDiagnosis | null = null;
      let healedCode: string | undefined;
      let healConfirmed = false;

      if (result.passed) {
        finalStatus = 'passed';
        await updateTestCase(tc.id, { status: 'passing', lastRunAt: new Date(), lastResult: { passed: true, duration: result.duration } });
      } else {
        diagnosis = await diagnoseFailure(tc.testCode, result.output);

        const selectorMap = (tc.selectorMap as Record<string, string> | null) ?? {};
        const healResult = diagnosis ? await healSelectors(tc.testCode, selectorMap, diagnosis, result.output) : null;

        if (healResult) {
          const healedResult = await runTestCode(healResult.healedCode);
          if (healedResult.passed) {
            healedCode = healResult.healedCode;
            healConfirmed = true;
            finalStatus = 'healed';
            await updateTestCase(tc.id, {
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
          await updateTestCase(tc.id, { status: 'failing', lastRunAt: new Date(), lastResult: { passed: false, duration: result.duration } });
        }
      }

      const execution = await createTestExecution({
        testCaseId: tc.id,
        status: finalStatus,
        duration: result.duration,
        output: result.output,
        diagnosis: diagnosis ?? undefined,
        healedCode,
      });

      results.push({
        testCaseId: tc.id,
        testCaseTitle: tc.title,
        executionId: execution.id,
        status: finalStatus as MemberExecutionResult['status'],
        duration: result.duration,
        healed: healConfirmed,
      });
    }

    const passed = results.filter((r) => r.status === 'passed').length;
    const healed = results.filter((r) => r.status === 'healed').length;
    const failed = results.filter((r) => r.status === 'failed' || r.status === 'error').length;

    logger.info({ groupId: id, passed, healed, failed }, 'Test group execution complete');

    const response: GroupExecutionResult = {
      testGroupId: id,
      testGroupName: group.name,
      results,
      passed,
      failed,
      healed,
      total: results.length,
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

export default router;
