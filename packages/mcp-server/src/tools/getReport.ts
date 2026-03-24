import { z } from 'zod';
import type { ShadowApiClient } from '../apiClient';

export const getReportSchema = z.object({
  reportId: z.string().min(1, 'reportId required'),
});

export type GetReportInput = z.infer<typeof getReportSchema>;

/**
 * shadow_get_report — get full bug report or code review content
 */
export async function getReport(client: ShadowApiClient, input: GetReportInput) {
  const report = await client.getReport(input.reportId);

  return {
    reportId: report.reportId,
    runId: report.runId,
    reportType: report.reportType,
    content: report.content,
    createdAt: report.createdAt,
  };
}
