'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useUsageStore, selectAllocation } from '../../stores/useUsageStore';

/**
 * CreditBadge — compact credit usage display for the navbar.
 * Shows remaining / total credits with a color-coded pill.
 */
export function CreditBadge(): JSX.Element {
  const { loadUsage } = useUsageStore();
  const allocation = useUsageStore(selectAllocation);

  useEffect(() => {
    void loadUsage();
  }, []);

  if (!allocation) {
    return (
      <Link
        href="/usage"
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted text-muted-foreground text-xs hover:bg-border transition-colors"
      >
        <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-pulse" />
        Credits
      </Link>
    );
  }

  const pct = allocation.totalCredits > 0
    ? (allocation.remainingCredits / allocation.totalCredits) * 100
    : 0;

  const color =
    pct > 40
      ? 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400'
      : pct > 15
        ? 'bg-yellow-100 dark:bg-yellow-950/40 text-yellow-700 dark:text-yellow-400'
        : 'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400';

  const dotColor =
    pct > 40 ? 'bg-green-500' : pct > 15 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <Link
      href="/usage"
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-opacity hover:opacity-80 ${color}`}
      title={`${allocation.remainingCredits} of ${allocation.totalCredits} credits remaining`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
      {allocation.remainingCredits}/{allocation.totalCredits}
    </Link>
  );
}
