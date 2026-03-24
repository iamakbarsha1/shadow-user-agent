import { z } from 'zod';
import type { ShadowApiClient } from '../apiClient';

export const getResultsSchema = z.object({
  runId: z.string().min(1, 'runId required'),
});

export type GetResultsInput = z.infer<typeof getResultsSchema>;

/**
 * shadow_get_results — get run status and report list for a run ID
 */
export async function getResults(client: ShadowApiClient, input: GetResultsInput) {
  const [run, reportsData] = await Promise.all([
    client.getRun(input.runId),
    client.getReports(input.runId).catch(() => ({ runId: input.runId, reports: [] })),
  ]);

  return {
    runId: run.runId,
    url: run.url,
    personaId: run.personaId,
    status: run.status,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    observationCount: run.observationCount,
    reports: reportsData.reports.map((r) => ({ type: r.reportType, id: r.reportId, createdAt: r.createdAt })),
  };
}
