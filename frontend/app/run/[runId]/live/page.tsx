'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '../../../../lib/api';
import { StatusBadge } from '../../../components/status-badge';

interface RunData {
  runId: string;
  url: string;
  personaId: string;
  status: string;
  startedAt: string;
  completedAt?: string;
  observationCount: number;
  reportIds: string[];
}

export default function LiveMonitor(): JSX.Element {
  const params = useParams();
  const runId = params.runId as string;
  const [run, setRun] = useState<RunData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRun = async (): Promise<void> => {
      try {
        const data = await api.getRun(runId);
        setRun(data);
        setLoading(false);
      } catch (error) {
        console.error('Failed to fetch run:', error);
        setLoading(false);
      }
    };

    void fetchRun();
    // Poll every 5 seconds - stops when run completes
    const interval = setInterval(() => {
      if (run?.status !== 'complete' && run?.status !== 'failed') {
        void fetchRun();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [runId, run?.status]);

  const isComplete = run?.status === 'complete';
  const isFailed = run?.status === 'failed';
  const startTime = run ? new Date(run.startedAt).getTime() : 0;
  const elapsed = run ? Math.floor((Date.now() - startTime) / 1000) : 0;

  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-card border-b border-border">
        <div className="max-w-5xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Live Monitor</h1>
              <p className="text-muted-foreground text-sm mt-1">Real-time agent execution status</p>
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
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="inline-block animate-status-pulse">
              <svg
                className="w-12 h-12 text-accent"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <circle cx="12" cy="12" r="10" opacity="0.3" />
                <path
                  d="M12 2a10 10 0 100 20 10 10 0 000-20zm0 18a8 8 0 110-16 8 8 0 010 16z"
                  opacity="0.7"
                />
              </svg>
            </div>
            <p className="text-muted-foreground mt-4">Loading run...</p>
          </div>
        ) : run ? (
          <div className="space-y-6">
            {/* Main Status Card */}
            <div className="p-8 rounded-lg bg-card border border-border space-y-6">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase">Status</h2>
                  <div className="mt-3">
                    <StatusBadge status={run.status as any} />
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground uppercase mb-2">Elapsed Time</p>
                  <p className="text-2xl font-mono font-bold text-accent">{elapsed}s</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                    Run ID
                  </h3>
                  <p className="font-mono text-sm text-foreground break-all">{run.runId}</p>
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                    Target URL
                  </h3>
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
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                    Persona
                  </h3>
                  <p className="text-sm text-foreground capitalize">
                    {run.personaId.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                  </p>
                </div>
              </div>
            </div>

            {/* Observations Counter */}
            <div className="p-6 rounded-lg bg-card border border-border">
              <div className="flex items-end justify-between">
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                    Observations Captured
                  </h3>
                  <p className="text-4xl font-bold text-accent">{run.observationCount}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Errors, layout shifts, and interactions logged
                  </p>
                </div>
                <div className="text-right">
                  <svg className="w-12 h-12 text-muted-foreground opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
              </div>
            </div>

            {/* Status-specific Cards */}
            {isComplete && (
              <div className="p-6 rounded-lg border border-emerald-500/30 bg-emerald-950/20 space-y-4">
                <div className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-emerald-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <div className="flex-1">
                    <h3 className="font-semibold text-emerald-200">Run completed successfully!</h3>
                    <p className="text-sm text-emerald-300 mt-1">
                      The agent found {run.observationCount} observations and generated {run.reportIds.length} reports.
                    </p>
                  </div>
                </div>
                <Link
                  href={`/reports/${runId}`}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-accent text-accent-foreground font-medium hover:opacity-90 transition-opacity duration-200"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  View Reports
                </Link>
              </div>
            )}

            {isFailed && (
              <div className="p-6 rounded-lg border border-red-500/30 bg-red-950/20">
                <div className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <div>
                    <h3 className="font-semibold text-red-200">Run failed</h3>
                    <p className="text-sm text-red-300 mt-1">
                      The agent encountered an error and could not complete the run. Check your target URL and try again.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {!isComplete && !isFailed && (
              <div className="p-6 rounded-lg border border-blue-500/30 bg-blue-950/20">
                <div className="flex items-start gap-3">
                  <div className="animate-status-pulse">
                    <svg className="w-6 h-6 text-blue-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5.951-1.429 5.951 1.429a1 1 0 001.169-1.409l-7-14z"
                      />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-blue-200">Agent is running</h3>
                    <p className="text-sm text-blue-300 mt-1">
                      The agent is actively exploring your application. This page will auto-update every 5 seconds.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Timeline */}
            <div className="p-6 rounded-lg bg-card border border-border">
              <h3 className="text-sm font-semibold text-foreground uppercase mb-4">Timeline</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-accent flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Run started</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(run.startedAt).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
                {run.completedAt && (
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-emerald-500 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Run completed</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(run.completedAt).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Navigation */}
            <div className="flex gap-3 pt-4">
              <Link
                href="/"
                className="flex-1 px-4 py-3 rounded-lg bg-muted hover:bg-border text-foreground font-medium text-center transition-colors duration-200"
              >
                Back to Dashboard
              </Link>
              {isComplete && (
                <Link
                  href={`/reports/${runId}`}
                  className="flex-1 px-4 py-3 rounded-lg bg-accent text-accent-foreground font-medium text-center hover:opacity-90 transition-opacity duration-200"
                >
                  View Reports
                </Link>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-16">
            <p className="text-muted-foreground">Run not found</p>
          </div>
        )}
      </div>
    </main>
  );
}
