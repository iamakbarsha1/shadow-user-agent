'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '../../../lib/api';
import { useReportStore } from '../../../stores/useReportStore';

interface RunData {
  runId: string;
  url: string;
  personaId: string;
  status: string;
  startedAt: string;
  completedAt?: string;
  observationCount: number;
}

interface Bug {
  id: string;
  title: string;
  severity: string;
  description: string;
  stepsToReproduce: string[];
  fixSuggestion: string;
}

interface UXFriction {
  id: string;
  title: string;
  description: string;
  impactedPersona: string;
}

interface BugReportContent {
  sessionSummary: string;
  bugs: Bug[];
  uxFrictionPoints: UXFriction[];
}

interface CodeIssue {
  title: string;
  description: string;
  codeLocation?: string;
  suggestedFix: string;
}

interface CodeReviewContent {
  overallAssessment: string;
  criticalIssues: CodeIssue[];
  improvements: CodeIssue[];
  positives: string[];
  recommendations: string[];
}

const severityConfig: Record<string, { color: string; label: string }> = {
  P1: { color: 'bg-red-950 text-red-200 border-red-800', label: 'Critical' },
  P2: { color: 'bg-orange-950 text-orange-200 border-orange-800', label: 'High' },
  P3: { color: 'bg-amber-950 text-amber-200 border-amber-800', label: 'Medium' },
  P4: { color: 'bg-blue-950 text-blue-200 border-blue-800', label: 'Low' },
};

export default function ReportViewer(): JSX.Element {
  const params = useParams();
  const runId = params.runId as string;
  const { reports, loading: reportsLoading, error, loadReports } = useReportStore();
  const [run, setRun] = useState<RunData | null>(null);
  const [runLoading, setRunLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'bug_report' | 'code_review'>('bug_report');
  const [pdfDownloading, setPdfDownloading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await api.getRun(runId);
        setRun(data);
      } catch (err) {
        console.error('Failed to fetch run:', err);
      } finally {
        setRunLoading(false);
      }
    };
    void fetchData();
    void loadReports(runId);
  }, [runId, loadReports]);

  const handleDownloadPDF = async () => {
    setPdfDownloading(true);
    try {
      const blob = await api.downloadReportPDF(runId);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `shadow-report-${runId.slice(0, 8)}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download PDF:', err);
      alert('Failed to download PDF. Please try again.');
    } finally {
      setPdfDownloading(false);
    }
  };

  const bugReportRaw = reports.find((r) => r.reportType === 'bug_report');
  const codeReviewRaw = reports.find((r) => r.reportType === 'code_review');
  const bugReportContent = bugReportRaw?.content as unknown as BugReportContent | undefined;
  const codeReviewContent = codeReviewRaw?.content as unknown as CodeReviewContent | undefined;

  const loading = runLoading || reportsLoading;

  if (loading) {
    return (
      <main className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-status-pulse mb-4">
            <svg className="w-12 h-12 text-accent" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" opacity="0.3" />
              <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm0 18a8 8 0 110-16 8 8 0 010 16z" opacity="0.7" />
            </svg>
          </div>
          <p className="text-muted-foreground">Loading reports...</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-background text-foreground">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="p-6 rounded-lg bg-red-950/20 border border-red-800 text-red-200">
            <p className="font-semibold">Error loading reports</p>
            <p className="text-sm mt-2">{error}</p>
            <Link href="/" className="mt-4 inline-block text-accent hover:underline text-sm font-medium">
              Back to Dashboard
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-card border-b border-border">
        <div className="max-w-5xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Test Reports</h1>
              <p className="text-muted-foreground text-sm mt-1">Bug analysis and code review</p>
            </div>
            <Link
              href="/"
              className="px-4 py-2 rounded-lg bg-muted hover:bg-border text-foreground text-sm font-medium transition-colors duration-200 inline-flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Run Metadata */}
        {run && (
          <div className="p-6 rounded-lg bg-card border border-border mb-8">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase mb-4">Run Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div>
                <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">URL</p>
                <a
                  href={run.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-accent hover:underline break-all"
                >
                  {run.url}
                </a>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">Persona</p>
                <p className="text-sm text-foreground capitalize">
                  {run.personaId.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">Status</p>
                <p className="text-sm text-emerald-400 font-semibold">Completed</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">Observations</p>
                <p className="text-2xl font-bold text-accent">{run.observationCount}</p>
              </div>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="mb-8 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex gap-1">
              <button
                onClick={() => setActiveTab('bug_report')}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors duration-200 ${
                  activeTab === 'bug_report'
                    ? 'border-accent text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                Bug Report
              </button>
              <button
                onClick={() => setActiveTab('code_review')}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors duration-200 ${
                  activeTab === 'code_review'
                    ? 'border-accent text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                Code Review
              </button>
            </div>
            <button
              onClick={handleDownloadPDF}
              disabled={pdfDownloading || reports.length === 0}
              className="px-4 py-2 rounded-lg bg-accent text-accent-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 inline-flex items-center gap-2"
            >
              {pdfDownloading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" strokeWidth="2" strokeOpacity="0.3" />
                    <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Generating...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  Export PDF
                </>
              )}
            </button>
          </div>
        </div>

        {/* Content */}
        {reports.length === 0 ? (
          <div className="text-center py-16 px-6 rounded-lg bg-card border border-border">
            <svg className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p className="text-muted-foreground">No reports generated yet</p>
            <p className="text-sm text-muted-foreground mt-1">Reports are generated after the agent run completes</p>
          </div>
        ) : activeTab === 'bug_report' && bugReportRaw ? (
          <div className="space-y-8">
            {/* Session Summary */}
            <div className="p-6 rounded-lg bg-card border border-border">
              <h2 className="text-lg font-semibold text-foreground mb-3">Session Summary</h2>
              <p className="text-muted-foreground leading-relaxed">{bugReportContent?.sessionSummary}</p>
            </div>

            {/* Bugs */}
            {(bugReportContent?.bugs?.length ?? 0) > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-4">
                  Bugs ({bugReportContent?.bugs.length})
                </h2>
                <div className="space-y-4">
                  {bugReportContent?.bugs.map((bug: Bug) => {
                    const severity = severityConfig[bug.severity] || severityConfig.P4;
                    return (
                      <div key={bug.id} className="p-6 rounded-lg bg-card border border-border space-y-4">
                        <div className="flex items-start justify-between gap-4">
                          <h3 className="text-base font-semibold text-foreground flex-1">{bug.title}</h3>
                          <span className={`px-3 py-1 text-xs font-semibold rounded-full border whitespace-nowrap ${severity.color}`}>
                            {bug.severity}
                          </span>
                        </div>
                        <p className="text-muted-foreground text-sm">{bug.description}</p>

                        {bug.stepsToReproduce?.length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold text-foreground mb-2">Steps to Reproduce</h4>
                            <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                              {bug.stepsToReproduce.map((step: string, i: number) => (
                                <li key={i}>{step}</li>
                              ))}
                            </ol>
                          </div>
                        )}

                        {bug.fixSuggestion && (
                          <div className="p-3 rounded-lg bg-emerald-950/20 border border-emerald-800">
                            <h4 className="text-sm font-semibold text-emerald-200 mb-1">Fix Suggestion</h4>
                            <p className="text-sm text-emerald-300">{bug.fixSuggestion}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* UX Friction Points */}
            {(bugReportContent?.uxFrictionPoints?.length ?? 0) > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-4">
                  UX Friction Points ({bugReportContent?.uxFrictionPoints.length})
                </h2>
                <div className="space-y-4">
                  {bugReportContent?.uxFrictionPoints.map((friction: UXFriction) => (
                    <div key={friction.id} className="p-6 rounded-lg bg-card border border-border space-y-3">
                      <h3 className="text-base font-semibold text-foreground">{friction.title}</h3>
                      <p className="text-muted-foreground text-sm">{friction.description}</p>
                      <p className="text-xs text-muted-foreground">
                        <span className="font-semibold">Impacted persona:</span> <span className="capitalize">{friction.impactedPersona?.replace('_', ' ')}</span>
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(bugReportContent?.bugs?.length ?? 0) === 0 && (bugReportContent?.uxFrictionPoints?.length ?? 0) === 0 && (
              <div className="p-6 rounded-lg bg-emerald-950/20 border border-emerald-800 text-center">
                <p className="text-emerald-200 font-semibold">✓ No bugs or UX friction points detected</p>
                <p className="text-emerald-300 text-sm mt-1">Your application passed the test run successfully!</p>
              </div>
            )}
          </div>
        ) : activeTab === 'code_review' && codeReviewRaw ? (
          <div className="space-y-8">
            {/* Overall Assessment */}
            <div className="p-6 rounded-lg bg-card border border-border">
              <h2 className="text-lg font-semibold text-foreground mb-3">Overall Assessment</h2>
              <p className="text-muted-foreground leading-relaxed">{codeReviewContent?.overallAssessment}</p>
            </div>

            {/* Critical Issues */}
            {(codeReviewContent?.criticalIssues?.length ?? 0) > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-red-400 mb-4">
                  Critical Issues ({codeReviewContent?.criticalIssues.length})
                </h2>
                <div className="space-y-4">
                  {codeReviewContent?.criticalIssues.map((issue: CodeIssue, i: number) => (
                    <div key={i} className="p-6 rounded-lg bg-card border-l-4 border-red-500 border-r border-t border-b border-border space-y-3">
                      <h3 className="text-base font-semibold text-foreground">{issue.title}</h3>
                      <p className="text-muted-foreground text-sm">{issue.description}</p>
                      {issue.codeLocation && (
                        <p className="text-xs text-muted-foreground font-mono bg-muted p-2 rounded">{issue.codeLocation}</p>
                      )}
                      {issue.suggestedFix && (
                        <div className="p-3 rounded-lg bg-emerald-950/20 border border-emerald-800">
                          <p className="text-sm text-emerald-300">{issue.suggestedFix}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Improvements */}
            {(codeReviewContent?.improvements?.length ?? 0) > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-amber-400 mb-4">
                  Improvements ({codeReviewContent?.improvements.length})
                </h2>
                <div className="space-y-4">
                  {codeReviewContent?.improvements.map((item: CodeIssue, i: number) => (
                    <div key={i} className="p-6 rounded-lg bg-card border-l-4 border-amber-500 border-r border-t border-b border-border space-y-3">
                      <h3 className="text-base font-semibold text-foreground">{item.title}</h3>
                      <p className="text-muted-foreground text-sm">{item.description}</p>
                      {item.suggestedFix && (
                        <div className="p-3 rounded-lg bg-emerald-950/20 border border-emerald-800">
                          <p className="text-sm text-emerald-300">{item.suggestedFix}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Positives */}
            {(codeReviewContent?.positives?.length ?? 0) > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-emerald-400 mb-4">Positives</h2>
                <div className="p-6 rounded-lg bg-card border border-border space-y-2">
                  {codeReviewContent?.positives.map((positive: string, i: number) => (
                    <div key={i} className="flex items-start gap-3">
                      <span className="text-emerald-400 font-bold mt-0.5">+</span>
                      <span className="text-muted-foreground text-sm">{positive}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recommendations */}
            {(codeReviewContent?.recommendations?.length ?? 0) > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-accent mb-4">Recommendations</h2>
                <div className="p-6 rounded-lg bg-card border border-border space-y-2">
                  {codeReviewContent?.recommendations.map((rec: string, i: number) => (
                    <div key={i} className="flex items-start gap-3">
                      <span className="text-accent font-bold mt-0.5">→</span>
                      <span className="text-muted-foreground text-sm">{rec}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-16 px-6 rounded-lg bg-card border border-border">
            <p className="text-muted-foreground">
              {activeTab === 'bug_report' ? 'No bug report' : 'No code review'} available for this run
            </p>
          </div>
        )}

        {/* Navigation */}
        <div className="flex gap-3 mt-12 pt-8 border-t border-border">
          <Link
            href="/"
            className="flex-1 px-4 py-3 rounded-lg bg-muted hover:bg-border text-foreground font-medium text-center transition-colors duration-200"
          >
            Back to Dashboard
          </Link>
          <Link
            href={`/run/${runId}/live`}
            className="flex-1 px-4 py-3 rounded-lg bg-border hover:bg-muted text-foreground font-medium text-center transition-colors duration-200"
          >
            View Live Monitor
          </Link>
        </div>
      </div>
    </main>
  );
}
