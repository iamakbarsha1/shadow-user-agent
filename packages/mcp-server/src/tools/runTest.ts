import { z } from 'zod';
import type { ShadowApiClient } from '../apiClient';

export const runTestSchema = z.object({
  url: z.string().url('Valid URL required'),
  personaId: z.enum(['new_user', 'power_user', 'mobile_user', 'edge_case']).default('new_user'),
  maxSteps: z.number().int().min(1).max(100).optional(),
  generateTests: z.boolean().optional(),
  prd: z.string().optional(),
  waitForCompletion: z.boolean().default(true),
});

export type RunTestInput = z.infer<typeof runTestSchema>;

/**
 * shadow_run_test — trigger a full agent run against a URL
 */
export async function runTest(client: ShadowApiClient, input: RunTestInput) {
  const run = await client.createRun(input.url, input.personaId, {
    maxSteps: input.maxSteps,
    generateTests: input.generateTests,
    prd: input.prd,
  });

  if (!input.waitForCompletion) {
    return {
      runId: run.runId,
      status: run.status,
      startedAt: run.startedAt,
      message: 'Run started. Use shadow_get_results to poll for completion.',
    };
  }

  const completed = await client.pollRunUntilComplete(run.runId);
  const reportsData = await client.getReports(run.runId);

  return {
    runId: run.runId,
    status: completed.status,
    reports: reportsData.reports.map((r) => ({ type: r.reportType, id: r.reportId })),
    message: `Run ${completed.status}. Use shadow_get_report to view full reports.`,
  };
}
