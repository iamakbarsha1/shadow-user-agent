'use client';

import { useState } from 'react';
import type { TestExecution } from '../../lib/api';
import { DiagnosisCard } from './diagnosis-card';

const STATUS_CONFIG = {
  passed: { label: 'Passed', dot: 'bg-green-500', text: 'text-green-600 dark:text-green-400' },
  failed: { label: 'Failed', dot: 'bg-red-500', text: 'text-red-600 dark:text-red-400' },
  healed: { label: 'Healed', dot: 'bg-purple-500', text: 'text-purple-600 dark:text-purple-400' },
  error: { label: 'Error', dot: 'bg-gray-400', text: 'text-muted-foreground' },
};

function ExecutionRow({ exec }: { exec: TestExecution }): JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const config = STATUS_CONFIG[exec.status] ?? STATUS_CONFIG.error;

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <span className={`w-2 h-2 rounded-full ${config.dot} shrink-0`} />
          <span className={`text-sm font-medium ${config.text}`}>{config.label}</span>
          <span className="text-xs text-muted-foreground">{exec.duration}ms</span>
          {exec.diagnosis && (
            <span className="text-xs bg-muted px-2 py-0.5 rounded text-muted-foreground">
              {exec.diagnosis.failureType}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {new Date(exec.executedAt).toLocaleString()}
          </span>
          <svg
            className={`w-4 h-4 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border px-4 py-4 space-y-4 bg-muted/10">
          {exec.diagnosis && <DiagnosisCard diagnosis={exec.diagnosis} />}

          {exec.healedCode && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Healed Code</p>
              <pre className="text-xs bg-background border border-border rounded-lg p-3 overflow-x-auto max-h-48 text-foreground">
                {exec.healedCode}
              </pre>
            </div>
          )}

          {exec.output && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Output</p>
              <pre className="text-xs bg-background border border-border rounded-lg p-3 overflow-x-auto max-h-48 text-muted-foreground whitespace-pre-wrap">
                {exec.output}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface HealingHistoryProps {
  executions: TestExecution[];
  total: number;
}

export function HealingHistory({ executions, total }: HealingHistoryProps): JSX.Element {
  if (executions.length === 0) {
    return (
      <div className="text-center py-10">
        <p className="text-sm text-muted-foreground">No executions yet.</p>
        <p className="text-xs text-muted-foreground mt-1">Run this test to see results here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-foreground">Execution History</h3>
        <span className="text-xs text-muted-foreground">{total} total</span>
      </div>
      {executions.map((exec) => (
        <ExecutionRow key={exec.id} exec={exec} />
      ))}
    </div>
  );
}
