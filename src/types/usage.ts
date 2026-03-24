/**
 * Usage tracking and credit allocation type definitions
 */

export type UsageAction = 'run' | 'test_generation' | 'test_execution' | 'group_execution';

/** Cost in credits for each action */
export const CREDIT_COSTS: Record<UsageAction, number> = {
  run: 10,
  test_generation: 5,
  test_execution: 2,
  group_execution: 2,
};

export interface UsageRecord {
  id: string;
  userId: string;
  action: UsageAction;
  cost: number;
  relatedId?: string;
  createdAt: string;
}

export interface CreditAllocation {
  id: string;
  userId: string;
  totalCredits: number;
  usedCredits: number;
  remainingCredits: number;
  periodStart: string;
  periodEnd: string;
}

export interface UsageSummary {
  allocation: CreditAllocation;
  recentRecords: UsageRecord[];
  totalRecords: number;
  byAction: Record<UsageAction, { count: number; totalCost: number }>;
}
