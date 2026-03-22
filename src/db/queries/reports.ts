import { prisma } from '../client';
import type { ReportType } from '../../types/report';

export async function saveReport(
  runId: string,
  reportType: ReportType,
  content: any
): Promise<string> {
  const report = await prisma.report.create({
    data: {
      runId,
      reportType,
      content: content as any,
    },
  });

  return report.id;
}

export async function getReportsByRunId(runId: string) {
  return await prisma.report.findMany({
    where: { runId },
    orderBy: { createdAt: 'asc' },
  });
}
