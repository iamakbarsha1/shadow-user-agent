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
      <main className="min-h-screen bg-gray-50 p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading reports...</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 p-6 rounded-lg">
            <p className="text-red-800">Error loading reports: {error}</p>
            <Link href="/" className="text-blue-600 hover:underline mt-4 block">
              Back to Dashboard
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'P1': return 'bg-red-100 text-red-800 border-red-200';
      case 'P2': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'P3': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'P4': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto">
        {/* Breadcrumb */}
        <nav className="mb-6 text-sm text-gray-500">
          <Link href="/" className="hover:text-blue-600">Dashboard</Link>
          <span className="mx-2">/</span>
          <Link href={`/run/${runId}/live`} className="hover:text-blue-600">Run {runId.slice(0, 8)}</Link>
          <span className="mx-2">/</span>
          <span className="text-gray-900">Reports</span>
        </nav>

        {/* Run Metadata Header */}
        {run && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <h3 className="text-xs font-medium text-gray-500 uppercase">URL</h3>
                <p className="text-sm font-mono truncate" title={run.url}>{run.url}</p>
              </div>
              <div>
                <h3 className="text-xs font-medium text-gray-500 uppercase">Persona</h3>
                <p className="text-sm capitalize">{run.personaId.replace('_', ' ')}</p>
              </div>
              <div>
                <h3 className="text-xs font-medium text-gray-500 uppercase">Status</h3>
                <p className="text-sm font-semibold text-green-600">{run.status.toUpperCase()}</p>
              </div>
              <div>
                <h3 className="text-xs font-medium text-gray-500 uppercase">Observations</h3>
                <p className="text-sm font-bold">{run.observationCount}</p>
              </div>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex items-center justify-between border-b border-gray-200 mb-6">
          <div className="flex">
            <button
              onClick={() => setActiveTab('bug_report')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'bug_report'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Bug Report
            </button>
            <button
              onClick={() => setActiveTab('code_review')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'code_review'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Code Review
            </button>
          </div>
          <button
            onClick={handleDownloadPDF}
            disabled={pdfDownloading || reports.length === 0}
            className={`px-4 py-2 text-sm font-medium rounded transition-colors ${
              pdfDownloading || reports.length === 0
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            {pdfDownloading ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Generating...
              </span>
            ) : (
              <span className="flex items-center">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export PDF
              </span>
            )}
          </button>
        </div>

        {/* No reports state */}
        {reports.length === 0 && (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-gray-500 text-lg">No reports generated yet.</p>
            <p className="text-gray-400 mt-2">Reports are generated after the agent run completes.</p>
          </div>
        )}

        {/* Bug Report Tab */}
        {activeTab === 'bug_report' && bugReportRaw && (
          <div className="space-y-6">
            {/* Session Summary */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-3">Session Summary</h2>
              <p className="text-gray-700">{bugReportContent?.sessionSummary}</p>
            </div>

            {/* Bugs */}
            {(bugReportContent?.bugs?.length ?? 0) > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-3">
                  Bugs ({bugReportContent?.bugs.length})
                </h2>
                <div className="space-y-4">
                  {bugReportContent?.bugs.map((bug: Bug) => (
                    <div key={bug.id} className="bg-white rounded-lg shadow p-6">
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="text-md font-semibold">{bug.title}</h3>
                        <span className={`px-3 py-1 text-xs font-bold rounded-full border ${getSeverityColor(bug.severity)}`}>
                          {bug.severity}
                        </span>
                      </div>
                      <p className="text-gray-700 mb-4">{bug.description}</p>

                      {bug.stepsToReproduce?.length > 0 && (
                        <div className="mb-4">
                          <h4 className="text-sm font-medium text-gray-500 mb-2">Steps to Reproduce</h4>
                          <ol className="list-decimal list-inside text-sm text-gray-600 space-y-1">
                            {bug.stepsToReproduce.map((step: string, i: number) => (
                              <li key={i}>{step}</li>
                            ))}
                          </ol>
                        </div>
                      )}

                      {bug.fixSuggestion && (
                        <div className="bg-green-50 p-3 rounded">
                          <h4 className="text-sm font-medium text-green-800 mb-1">Fix Suggestion</h4>
                          <p className="text-sm text-green-700">{bug.fixSuggestion}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* UX Friction Points */}
            {(bugReportContent?.uxFrictionPoints?.length ?? 0) > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-3">
                  UX Friction Points ({bugReportContent?.uxFrictionPoints.length})
                </h2>
                <div className="space-y-4">
                  {bugReportContent?.uxFrictionPoints.map((friction: UXFriction) => (
                    <div key={friction.id} className="bg-white rounded-lg shadow p-6">
                      <h3 className="text-md font-semibold mb-2">{friction.title}</h3>
                      <p className="text-gray-700 mb-2">{friction.description}</p>
                      <p className="text-sm text-gray-500">
                        Impacted persona: <span className="capitalize">{friction.impactedPersona?.replace('_', ' ')}</span>
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(bugReportContent?.bugs?.length ?? 0) === 0 && (bugReportContent?.uxFrictionPoints?.length ?? 0) === 0 && (
              <div className="bg-green-50 rounded-lg p-6 text-center">
                <p className="text-green-800 font-medium">No bugs or UX friction points detected.</p>
              </div>
            )}
          </div>
        )}

        {/* Code Review Tab */}
        {activeTab === 'code_review' && codeReviewRaw && (
          <div className="space-y-6">
            {/* Overall Assessment */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-3">Overall Assessment</h2>
              <p className="text-gray-700">{codeReviewContent?.overallAssessment}</p>
            </div>

            {/* Critical Issues */}
            {(codeReviewContent?.criticalIssues?.length ?? 0) > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-3 text-red-700">
                  Critical Issues ({codeReviewContent?.criticalIssues.length})
                </h2>
                <div className="space-y-4">
                  {codeReviewContent?.criticalIssues.map((issue: CodeIssue, i: number) => (
                    <div key={i} className="bg-white rounded-lg shadow p-6 border-l-4 border-red-500">
                      <h3 className="text-md font-semibold mb-2">{issue.title}</h3>
                      <p className="text-gray-700 mb-3">{issue.description}</p>
                      {issue.codeLocation && (
                        <p className="text-sm text-gray-500 font-mono mb-2">{issue.codeLocation}</p>
                      )}
                      {issue.suggestedFix && (
                        <div className="bg-green-50 p-3 rounded">
                          <p className="text-sm text-green-700">{issue.suggestedFix}</p>
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
                <h2 className="text-lg font-semibold mb-3 text-orange-700">
                  Improvements ({codeReviewContent?.improvements.length})
                </h2>
                <div className="space-y-4">
                  {codeReviewContent?.improvements.map((item: CodeIssue, i: number) => (
                    <div key={i} className="bg-white rounded-lg shadow p-6 border-l-4 border-orange-400">
                      <h3 className="text-md font-semibold mb-2">{item.title}</h3>
                      <p className="text-gray-700 mb-3">{item.description}</p>
                      {item.suggestedFix && (
                        <div className="bg-green-50 p-3 rounded">
                          <p className="text-sm text-green-700">{item.suggestedFix}</p>
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
                <h2 className="text-lg font-semibold mb-3 text-green-700">Positives</h2>
                <div className="bg-white rounded-lg shadow p-6">
                  <ul className="space-y-2">
                    {codeReviewContent?.positives.map((positive: string, i: number) => (
                      <li key={i} className="flex items-start">
                        <span className="text-green-500 mr-2 mt-0.5">+</span>
                        <span className="text-gray-700">{positive}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Recommendations */}
            {(codeReviewContent?.recommendations?.length ?? 0) > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-3">Recommendations</h2>
                <div className="bg-white rounded-lg shadow p-6">
                  <ul className="space-y-2">
                    {codeReviewContent?.recommendations.map((rec: string, i: number) => (
                      <li key={i} className="flex items-start">
                        <span className="text-blue-500 mr-2 mt-0.5">-</span>
                        <span className="text-gray-700">{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}

        {/* No report for this tab */}
        {activeTab === 'bug_report' && !bugReportRaw && reports.length > 0 && (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-gray-500">No bug report available for this run.</p>
          </div>
        )}
        {activeTab === 'code_review' && !codeReviewRaw && reports.length > 0 && (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-gray-500">No code review available for this run.</p>
          </div>
        )}

        {/* Navigation */}
        <div className="mt-8 flex gap-4">
          <Link
            href="/"
            className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
          >
            Back to Dashboard
          </Link>
          <Link
            href={`/run/${runId}/live`}
            className="px-4 py-2 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
          >
            View Live Monitor
          </Link>
        </div>
      </div>
    </main>
  );
}
