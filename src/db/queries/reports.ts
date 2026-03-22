import { Prisma } from '@prisma/client';
import { prisma } from '../client';
import type { ReportType } from '../../types/report';

export async function saveReport(
  runId: string,
  reportType: ReportType,
  content: unknown
): Promise<string> {
  const report = await prisma.report.create({
    data: {
      runId,
      reportType,
      content: content as Prisma.InputJsonValue,
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

export async function findReportById(reportId: string) {
  return await prisma.report.findUnique({
    where: { id: reportId },
  });
}
