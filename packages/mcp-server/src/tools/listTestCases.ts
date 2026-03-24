import { z } from 'zod';
import type { ShadowApiClient } from '../apiClient';

export const listTestCasesSchema = z.object({
  runId: z.string().min(1, 'runId required'),
});

export type ListTestCasesInput = z.infer<typeof listTestCasesSchema>;

/**
 * shadow_list_test_cases — list test cases for a run
 */
export async function listTestCases(client: ShadowApiClient, input: ListTestCasesInput) {
  const data = await client.listTestCases(input.runId);

  return {
    runId: data.runId,
    total: data.total,
    testCases: data.testCases.map((tc) => ({
      id: tc.id,
      title: tc.title,
      description: tc.description,
      status: tc.status,
      framework: tc.framework,
      createdAt: tc.createdAt,
    })),
  };
}
