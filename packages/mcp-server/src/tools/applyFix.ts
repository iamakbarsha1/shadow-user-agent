import { z } from 'zod';
import type { ShadowApiClient } from '../apiClient';

export const applyFixSchema = z.object({
  testCaseId: z.string().min(1, 'testCaseId required'),
});

export type ApplyFixInput = z.infer<typeof applyFixSchema>;

/**
 * shadow_apply_fix — trigger auto-healing for a failing test case
 * Runs the test, diagnoses failure, attempts selector healing, and confirms the fix
 */
export async function applyFix(client: ShadowApiClient, input: ApplyFixInput) {
  const result = await client.executeTestCase(input.testCaseId);

  return {
    testCaseId: input.testCaseId,
    executionId: result.executionId,
    status: result.status,
    healed: result.healed,
    duration: result.duration,
    diagnosis: result.diagnosis,
    message: result.healed
      ? 'Fix applied successfully. The healed test code has been saved back to the test case.'
      : result.status === 'passed'
        ? 'Test is already passing. No fix needed.'
        : 'Auto-healing was not able to fix this test. Manual intervention required.',
  };
}
