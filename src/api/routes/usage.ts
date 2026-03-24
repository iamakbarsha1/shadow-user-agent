import { Router, type Request, type Response, type NextFunction } from 'express';
import { getUsageSummary } from '../../db/queries/usage';
import { findOrCreateAllocation } from '../../db/queries/usage';
import type { UsageAction, UsageSummary } from '../../types/usage';

const router = Router();

/**
 * GET /api/v1/usage
 * Returns the current user's credit allocation and recent usage records.
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId ?? 'anonymous';
    const { allocation, records, totalRecords, byAction } = await getUsageSummary(userId);

    const actionMap: Record<string, { count: number; totalCost: number }> = {};
    for (const row of byAction) {
      actionMap[row.action] = {
        count: row._count.id,
        totalCost: row._sum.cost ?? 0,
      };
    }

    const response: UsageSummary = {
      allocation: {
        id: allocation.id,
        userId: allocation.userId,
        totalCredits: allocation.totalCredits,
        usedCredits: allocation.usedCredits,
        remainingCredits: allocation.totalCredits - allocation.usedCredits,
        periodStart: allocation.periodStart.toISOString(),
        periodEnd: allocation.periodEnd.toISOString(),
      },
      recentRecords: records.map((r) => ({
        id: r.id,
        userId: r.userId,
        action: r.action as UsageAction,
        cost: r.cost,
        relatedId: r.relatedId ?? undefined,
        createdAt: r.createdAt.toISOString(),
      })),
      totalRecords,
      byAction: {
        run: actionMap['run'] ?? { count: 0, totalCost: 0 },
        test_generation: actionMap['test_generation'] ?? { count: 0, totalCost: 0 },
        test_execution: actionMap['test_execution'] ?? { count: 0, totalCost: 0 },
        group_execution: actionMap['group_execution'] ?? { count: 0, totalCost: 0 },
      },
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/usage/reset (dev only) — resets usage for testing
 */
router.post('/reset', async (req: Request, res: Response, next: NextFunction) => {
  if (process.env.NODE_ENV !== 'development') {
    res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Only available in development', details: {} } });
    return;
  }
  try {
    const userId = req.user?.userId ?? 'anonymous';
    await findOrCreateAllocation(userId);
    const { prisma } = await import('../../db/client');
    await prisma.creditAllocation.update({
      where: { userId },
      data: { usedCredits: 0 },
    });
    await prisma.usageRecord.deleteMany({ where: { userId } });
    res.status(200).json({ reset: true });
  } catch (error) {
    next(error);
  }
});

export default router;
