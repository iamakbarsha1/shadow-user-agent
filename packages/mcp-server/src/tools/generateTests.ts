import { z } from 'zod';
import type { ShadowApiClient } from '../apiClient';

export const generateTestsSchema = z.object({
  url: z.string().url('Valid URL required'),
  personaId: z.enum(['new_user', 'power_user', 'mobile_user', 'edge_case']).default('new_user'),
  prd: z.string().optional(),
  maxSteps: z.number().int().min(1).max(100).optional(),
});

export type GenerateTestsInput = z.infer<typeof generateTestsSchema>;

/**
 * shadow_generate_tests — run agent with test generation enabled, return test cases
 */
export async function generateTests(client: ShadowApiClient, input: GenerateTestsInput) {
  const run = await client.createRun(input.url, input.personaId, {
    maxSteps: input.maxSteps,
    generateTests: true,
    prd: input.prd,
  });

  const completed = await client.pollRunUntilComplete(run.runId);

  if (completed.status === 'failed') {
    return { runId: run.runId, status: 'failed', testCases: [], total: 0 };
  }

  const { testCases, total } = await client.listTestCases(run.runId);

  return {
    runId: run.runId,
    status: completed.status,
    total,
    testCases: testCases.map((tc) => ({
      id: tc.id,
      title: tc.title,
      description: tc.description,
      testCode: tc.testCode,
      framework: tc.framework,
    })),
  };
}
