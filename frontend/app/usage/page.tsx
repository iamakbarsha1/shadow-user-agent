'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useUsageStore } from '../../stores/useUsageStore';
import type { UsageAction } from '../../lib/api';

const ACTION_LABELS: Record<UsageAction, { label: string; cost: number }> = {
  run: { label: 'Agent Run', cost: 10 },
  test_generation: { label: 'Test Generation', cost: 5 },
  test_execution: { label: 'Test Execution', cost: 2 },
  group_execution: { label: 'Group Execution', cost: 2 },
};

const ACTION_COLORS: Record<UsageAction, string> = {
  run: 'bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-400',
  test_generation: 'bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400',
  test_execution: 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400',
  group_execution: 'bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-400',
};

export default function UsagePage(): JSX.Element {
  const { summary, loading, error, loadUsage, resetUsage } = useUsageStore();

  useEffect(() => {
    void loadUsage();
  }, []);

  const allocation = summary?.allocation;
  const pct = allocation
    ? Math.round((allocation.remainingCredits / allocation.totalCredits) * 100)
    : 0;

  const barColor =
    pct > 40 ? 'bg-green-500' : pct > 15 ? 'bg-yellow-500' : 'bg-red-500';

  const handleReset = async () => {
    if (!confirm('Reset all usage data for this period?')) return;
    await resetUsage();
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-card border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 className="text-sm font-semibold text-foreground">Usage & Credits</h1>
              <p className="text-xs text-muted-foreground">Track your credit consumption</p>
            </div>
          </div>
          {process.env.NODE_ENV === 'development' && (
            <button
              type="button"
              onClick={handleReset}
              className="text-xs text-muted-foreground hover:text-red-500 transition-colors px-2 py-1 rounded"
            >
              Reset (dev)
            </button>
          )}
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Error */}
        {error && (
          <div className="p-4 border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900 rounded-xl text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && !summary && (
          <div className="space-y-4">
            <div className="h-32 rounded-xl bg-muted animate-pulse" />
            <div className="h-48 rounded-xl bg-muted animate-pulse" />
          </div>
        )}

        {allocation && (
          <>
            {/* Credit meter card */}
            <div className="border border-border rounded-xl bg-card p-5 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Credits Remaining</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Period: {new Date(allocation.periodStart).toLocaleDateString()} –{' '}
                    {new Date(allocation.periodEnd).toLocaleDateString()}
                  </p>
                </div>
                <span className="text-2xl font-bold text-foreground tabular-nums">
                  {allocation.remainingCredits}
                  <span className="text-sm font-normal text-muted-foreground ml-1">
                    / {allocation.totalCredits}
                  </span>
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-2 rounded-full transition-all duration-500 ${barColor}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">{pct}% remaining · {allocation.usedCredits} used</p>
            </div>

            {/* Usage by action */}
            {summary && (
              <div className="border border-border rounded-xl bg-card overflow-hidden">
                <div className="px-4 py-3 border-b border-border">
                  <h2 className="text-sm font-semibold text-foreground">Usage by Action</h2>
                </div>
                <div className="divide-y divide-border">
                  {(Object.keys(ACTION_LABELS) as UsageAction[]).map((action) => {
                    const info = summary.byAction[action];
                    const label = ACTION_LABELS[action];
                    return (
                      <div key={action} className="flex items-center gap-3 px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${ACTION_COLORS[action]}`}>
                          {label.label}
                        </span>
                        <div className="flex-1" />
                        <span className="text-xs text-muted-foreground shrink-0">
                          {info.count} action{info.count !== 1 ? 's' : ''}
                        </span>
                        <span className="text-xs font-medium text-foreground shrink-0 w-16 text-right tabular-nums">
                          {info.totalCost} credits
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Recent records */}
            {summary && summary.recentRecords.length > 0 && (
              <div className="border border-border rounded-xl bg-card overflow-hidden">
                <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-foreground">Recent Activity</h2>
                  <span className="text-xs text-muted-foreground">{summary.totalRecords} total</span>
                </div>
                <div className="divide-y divide-border">
                  {summary.recentRecords.map((record) => (
                    <div key={record.id} className="flex items-center gap-3 px-4 py-2.5">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${ACTION_COLORS[record.action]}`}>
                        {ACTION_LABELS[record.action]?.label ?? record.action}
                      </span>
                      <span className="text-xs text-muted-foreground flex-1 min-w-0 truncate">
                        {record.relatedId ? `id: ${record.relatedId.slice(0, 8)}…` : '—'}
                      </span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {new Date(record.createdAt).toLocaleString()}
                      </span>
                      <span className="text-xs font-medium text-foreground shrink-0 w-14 text-right tabular-nums">
                        -{record.cost} cr
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty state */}
            {summary && summary.recentRecords.length === 0 && (
              <div className="text-center py-12">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-sm text-muted-foreground">No usage recorded yet.</p>
                <p className="text-xs text-muted-foreground mt-1">Credits are consumed when you run tests and agent sessions.</p>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
