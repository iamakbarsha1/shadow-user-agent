'use client';

import type { FailureDiagnosis } from '../../lib/api';

const TYPE_CONFIG = {
  selector: { label: 'Broken Selector', color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-950/20', border: 'border-orange-200 dark:border-orange-900' },
  timeout: { label: 'Timeout', color: 'text-yellow-600', bg: 'bg-yellow-50 dark:bg-yellow-950/20', border: 'border-yellow-200 dark:border-yellow-900' },
  assertion: { label: 'Assertion Failure', color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-950/20', border: 'border-blue-200 dark:border-blue-900' },
  network: { label: 'Network Error', color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-950/20', border: 'border-red-200 dark:border-red-900' },
  unknown: { label: 'Unknown', color: 'text-muted-foreground', bg: 'bg-muted', border: 'border-border' },
};

interface DiagnosisCardProps {
  diagnosis: FailureDiagnosis;
}

export function DiagnosisCard({ diagnosis }: DiagnosisCardProps): JSX.Element {
  const config = TYPE_CONFIG[diagnosis.failureType] ?? TYPE_CONFIG.unknown;

  return (
    <div className={`rounded-xl border p-4 space-y-3 ${config.bg} ${config.border}`}>
      <div className="flex items-center gap-2">
        <span className={`text-xs font-semibold uppercase tracking-wider ${config.color}`}>
          {config.label}
        </span>
      </div>

      <div>
        <p className="text-xs text-muted-foreground font-medium mb-0.5">Root Cause</p>
        <p className="text-sm text-foreground">{diagnosis.diagnosis}</p>
      </div>

      <div>
        <p className="text-xs text-muted-foreground font-medium mb-0.5">Suggested Fix</p>
        <p className="text-sm text-foreground">{diagnosis.suggestedFix}</p>
      </div>

      {diagnosis.affectedSelectors.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground font-medium mb-1">Affected Selectors</p>
          <div className="flex flex-wrap gap-1.5">
            {diagnosis.affectedSelectors.map((sel, i) => (
              <code
                key={i}
                className="text-xs bg-background border border-border rounded px-1.5 py-0.5 text-foreground"
              >
                {sel}
              </code>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
