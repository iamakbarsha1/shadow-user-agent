import { prisma } from '../client';
import type { UsageAction } from '../../types/usage';

const DEFAULT_CREDITS = 500;
const PERIOD_DAYS = 30;

/**
 * Returns the active credit allocation for a user, creating one if it doesn't exist.
 */
export async function findOrCreateAllocation(userId: string) {
  const existing = await prisma.creditAllocation.findUnique({ where: { userId } });
  if (existing) return existing;

  const periodStart = new Date();
  const periodEnd = new Date(periodStart);
  periodEnd.setDate(periodEnd.getDate() + PERIOD_DAYS);

  return await prisma.creditAllocation.create({
    data: { userId, totalCredits: DEFAULT_CREDITS, usedCredits: 0, periodStart, periodEnd },
  });
}

/**
 * Atomically records a usage event and increments the used-credits counter.
 * Does NOT enforce the limit — call creditGuard middleware before actions.
 */
export async function recordUsage(
  userId: string,
  action: UsageAction,
  cost: number,
  relatedId?: string
) {
  const [record] = await prisma.$transaction([
    prisma.usageRecord.create({ data: { userId, action, cost, relatedId } }),
    prisma.creditAllocation.updateMany({
      where: { userId },
      data: { usedCredits: { increment: cost } },
    }),
  ]);
  return record;
}

/**
 * Returns the allocation + recent usage records for a user.
 */
export async function getUsageSummary(userId: string) {
  const allocation = await findOrCreateAllocation(userId);

  const records = await prisma.usageRecord.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  const totalRecords = await prisma.usageRecord.count({ where: { userId } });

  // Aggregate by action
  const byAction = await prisma.usageRecord.groupBy({
    by: ['action'],
    where: { userId },
    _count: { id: true },
    _sum: { cost: true },
  });

  return { allocation, records, totalRecords, byAction };
}
