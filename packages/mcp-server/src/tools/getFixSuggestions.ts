import { z } from 'zod';
import type { ShadowApiClient } from '../apiClient';

export const getFixSuggestionsSchema = z.object({
  testGroupId: z.string().min(1, 'testGroupId required'),
});

export type GetFixSuggestionsInput = z.infer<typeof getFixSuggestionsSchema>;

/**
 * shadow_get_fix_suggestions — retrieve AI-generated fix suggestions for failing tests in a group
 * Returns the latest failure diagnosis and healed code for each failing member
 */
export async function getFixSuggestions(client: ShadowApiClient, input: GetFixSuggestionsInput) {
  const group = await client.getTestGroup(input.testGroupId);

  const suggestions: Array<{
    testCaseId: string;
    testCaseTitle: string;
    status: string;
    latestExecution?: {
      executionId: string;
      status: string;
      diagnosis: unknown;
      healedCode: string | null | undefined;
    };
  }> = [];

  for (const member of group.memberships ?? []) {
    const tc = member.testCase;
    if (!tc) continue;

    if (tc.status === 'failing' || tc.status === 'generated') {
      const executions = await client.listTestExecutions(tc.id);
      const latest = executions[0];

      suggestions.push({
        testCaseId: tc.id,
        testCaseTitle: tc.title,
        status: tc.status,
        latestExecution: latest
          ? {
              executionId: latest.id,
              status: latest.status,
              diagnosis: latest.diagnosis,
              healedCode: latest.healedCode,
            }
          : undefined,
      });
    }
  }

  return {
    testGroupId: group.id,
    testGroupName: group.name,
    totalMembers: (group.memberships ?? []).length,
    failingCount: suggestions.length,
    suggestions,
    message:
      suggestions.length === 0
        ? 'All tests in this group are passing.'
        : `${suggestions.length} test(s) have fix suggestions. Use shadow_apply_fix to apply healed code.`,
  };
}
