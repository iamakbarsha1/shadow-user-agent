import { z } from 'zod';
import type { ShadowApiClient } from '../apiClient';

export const executeTestCaseSchema = z.object({
  testCaseId: z.string().min(1, 'testCaseId required'),
});

export type ExecuteTestCaseInput = z.infer<typeof executeTestCaseSchema>;

/**
 * shadow_execute_test — get test case code (execution handled by Phase 12)
 * Returns the test code ready for the IDE agent to run locally
 */
export async function executeTestCase(client: ShadowApiClient, input: ExecuteTestCaseInput) {
  const tc = await client.getTestCase(input.testCaseId);

  return {
    id: tc.id,
    runId: tc.runId,
    title: tc.title,
    testCode: tc.testCode,
    status: tc.status,
    message: 'Test code retrieved. Run with: npx playwright test --inline',
  };
}
