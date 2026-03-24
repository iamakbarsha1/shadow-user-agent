import type { Request, Response, NextFunction } from 'express';
import { findOrCreateAllocation } from '../../db/queries/usage';
import { CreditLimitExceededError } from '../../utils/errors';

/**
 * Middleware factory that enforces credit limits before allowing an action.
 * Skips enforcement in development mode (always allows).
 *
 * Usage:
 *   router.post('/', requireCredits(10), handler)
 */
export function requireCredits(cost: number) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    // Development mode — skip enforcement
    if (process.env.NODE_ENV === 'development') {
      return next();
    }

    const userId = req.user?.userId;
    if (!userId) return next();

    try {
      const allocation = await findOrCreateAllocation(userId);
      const remaining = allocation.totalCredits - allocation.usedCredits;

      if (remaining < cost) {
        return next(new CreditLimitExceededError(remaining, cost));
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
