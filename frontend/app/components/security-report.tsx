'use client';

interface SecurityFinding {
  checkName: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  description: string;
  evidence?: string;
  recommendation: string;
}

interface SecurityReportContent {
  summary: string;
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  findings: SecurityFinding[];
  overallRisk: 'critical' | 'high' | 'medium' | 'low' | 'safe';
}

interface SecurityReportProps {
  content: SecurityReportContent;
}

const riskBannerColors: Record<string, string> = {
  critical: 'bg-red-950 border-red-800 text-red-100',
  high: 'bg-orange-950 border-orange-800 text-orange-100',
  medium: 'bg-amber-950 border-amber-800 text-amber-100',
  low: 'bg-blue-950 border-blue-800 text-blue-100',
  safe: 'bg-emerald-950 border-emerald-800 text-emerald-100',
};

const riskBadgeColors: Record<string, string> = {
  critical: 'bg-red-800 text-red-100 border border-red-700',
  high: 'bg-orange-800 text-orange-100 border border-orange-700',
  medium: 'bg-amber-800 text-amber-100 border border-amber-700',
  low: 'bg-blue-800 text-blue-100 border border-blue-700',
  safe: 'bg-emerald-800 text-emerald-100 border border-emerald-700',
};

const severityBadgeColors: Record<string, string> = {
  critical: 'bg-red-950 text-red-200 border border-red-800',
  high: 'bg-orange-950 text-orange-200 border border-orange-800',
  medium: 'bg-amber-950 text-amber-200 border border-amber-800',
  low: 'bg-blue-950 text-blue-200 border border-blue-800',
  info: 'bg-muted text-muted-foreground border border-border',
};

const severityBarColors: Record<string, string> = {
  critical: 'bg-red-600',
  high: 'bg-orange-500',
  medium: 'bg-amber-500',
  low: 'bg-blue-500',
};

/**
 * Renders a security report with risk banner, severity breakdown, and findings list.
 */
export function SecurityReport({ content }: SecurityReportProps): JSX.Element {
  const {
    summary,
    totalChecks,
    passedChecks,
    failedChecks,
    criticalCount,
    highCount,
    mediumCount,
    lowCount,
    findings,
    overallRisk,
  } = content;

  const bannerClass = riskBannerColors[overallRisk] ?? riskBannerColors.safe;
  const badgeClass = riskBadgeColors[overallRisk] ?? riskBadgeColors.safe;

  const totalFindings = criticalCount + highCount + mediumCount + lowCount;

  return (
    <div className="space-y-8">
      {/* Risk Banner */}
      <div className={`p-6 rounded-lg border ${bannerClass}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              <span className={`px-3 py-1 text-sm font-bold rounded-full uppercase ${badgeClass}`}>
                {overallRisk} risk
              </span>
            </div>
            <p className="text-sm leading-relaxed opacity-90">{summary}</p>
          </div>
          <div className="text-right shrink-0">
            <div className="text-3xl font-bold">{totalChecks}</div>
            <div className="text-xs opacity-70 uppercase tracking-wide">checks run</div>
            <div className="mt-2 text-sm font-semibold">
              <span className="text-emerald-400">{passedChecks} passed</span>
              {failedChecks > 0 && (
                <span className="ml-2 text-red-300">{failedChecks} failed</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Severity Breakdown Bar */}
      {totalFindings > 0 && (
        <div className="p-6 rounded-lg bg-card border border-border">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase mb-4">Severity Breakdown</h2>
          <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
            {criticalCount > 0 && (
              <div
                className={`${severityBarColors.critical} rounded-sm`}
                style={{ width: `${(criticalCount / totalFindings) * 100}%` }}
                title={`Critical: ${criticalCount}`}
              />
            )}
            {highCount > 0 && (
              <div
                className={`${severityBarColors.high} rounded-sm`}
                style={{ width: `${(highCount / totalFindings) * 100}%` }}
                title={`High: ${highCount}`}
              />
            )}
            {mediumCount > 0 && (
              <div
                className={`${severityBarColors.medium} rounded-sm`}
                style={{ width: `${(mediumCount / totalFindings) * 100}%` }}
                title={`Medium: ${mediumCount}`}
              />
            )}
            {lowCount > 0 && (
              <div
                className={`${severityBarColors.low} rounded-sm`}
                style={{ width: `${(lowCount / totalFindings) * 100}%` }}
                title={`Low: ${lowCount}`}
              />
            )}
          </div>
          <div className="flex gap-6 mt-3 flex-wrap">
            {criticalCount > 0 && (
              <div className="flex items-center gap-1.5 text-sm">
                <span className={`w-3 h-3 rounded-sm inline-block ${severityBarColors.critical}`} />
                <span className="text-muted-foreground">Critical <span className="font-semibold text-foreground">{criticalCount}</span></span>
              </div>
            )}
            {highCount > 0 && (
              <div className="flex items-center gap-1.5 text-sm">
                <span className={`w-3 h-3 rounded-sm inline-block ${severityBarColors.high}`} />
                <span className="text-muted-foreground">High <span className="font-semibold text-foreground">{highCount}</span></span>
              </div>
            )}
            {mediumCount > 0 && (
              <div className="flex items-center gap-1.5 text-sm">
                <span className={`w-3 h-3 rounded-sm inline-block ${severityBarColors.medium}`} />
                <span className="text-muted-foreground">Medium <span className="font-semibold text-foreground">{mediumCount}</span></span>
              </div>
            )}
            {lowCount > 0 && (
              <div className="flex items-center gap-1.5 text-sm">
                <span className={`w-3 h-3 rounded-sm inline-block ${severityBarColors.low}`} />
                <span className="text-muted-foreground">Low <span className="font-semibold text-foreground">{lowCount}</span></span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Findings List */}
      {findings.length === 0 ? (
        <div className="p-6 rounded-lg bg-emerald-950/20 border border-emerald-800 text-center">
          <p className="text-emerald-200 font-semibold">No security issues found — all checks passed</p>
          <p className="text-emerald-300 text-sm mt-1">Your application passed all security checks successfully!</p>
        </div>
      ) : (
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Findings ({findings.length})
          </h2>
          <div className="space-y-4">
            {findings.map((finding, i) => {
              const badgeColorClass = severityBadgeColors[finding.severity] ?? severityBadgeColors.info;
              return (
                <div key={i} className="p-6 rounded-lg bg-card border border-border space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2.5 py-0.5 text-xs font-bold rounded-full uppercase ${badgeColorClass}`}>
                          {finding.severity}
                        </span>
                        <span className="font-mono text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                          {finding.checkName}
                        </span>
                      </div>
                      <h3 className="text-base font-semibold text-foreground">{finding.title}</h3>
                    </div>
                  </div>
                  <p className="text-muted-foreground text-sm">{finding.description}</p>
                  {finding.evidence && (
                    <div className="p-3 rounded-lg bg-muted border border-border">
                      <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Evidence</p>
                      <code className="text-xs font-mono text-foreground break-all">{finding.evidence}</code>
                    </div>
                  )}
                  <p className="text-sm text-muted-foreground italic">
                    <span className="text-accent not-italic font-medium mr-1">→</span>
                    {finding.recommendation}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
