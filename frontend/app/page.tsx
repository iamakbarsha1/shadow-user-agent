'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useRunStore } from '../stores/useRunStore';
import Link from 'next/link';
import { StatusBadge } from './components/status-badge';
import { RunFilter, FilterState } from './components/run-filter';
import { CreditBadge } from './components/credit-badge';

export default function Dashboard(): JSX.Element {
  const { runs, loading, loadRuns } = useRunStore();
  const router = useRouter();
  const [filters, setFilters] = useState<FilterState>({
    status: [],
    persona: [],
    url: '',
  });
  const [showFilters, setShowFilters] = useState(false);

  const handleRowClick = (run: { runId: string; status: string }) => {
    if (run.status === 'complete') {
      router.push(`/reports/${run.runId}`);
    } else {
      router.push(`/run/${run.runId}/live`);
    }
  };

  useEffect(() => {
    void loadRuns();
  }, []);

  useEffect(() => {
    // Only poll if there are active runs
    if (!runs.some((r) => r.status === 'running' || r.status === 'pending')) {
      return;
    }

    const interval = setInterval(() => {
      void loadRuns();
    }, 10000);

    return () => clearInterval(interval);
  }, [runs, loadRuns]);

  // Filter runs based on active filters
  const filteredRuns = runs.filter((run) => {
    const statusMatch =
      filters.status.length === 0 || filters.status.includes(run.status as string);
    const personaMatch =
      filters.persona.length === 0 || filters.persona.includes(run.personaId);
    const urlMatch = filters.url === '' || run.url.toLowerCase().includes(filters.url.toLowerCase());
    return statusMatch && personaMatch && urlMatch;
  });

  const activeFilterCount = filters.status.length + filters.persona.length + (filters.url ? 1 : 0);

  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Shadow User Agent</h1>
              <p className="text-muted-foreground text-sm mt-1">
                AI-powered QA system monitoring {runs.length} runs
              </p>
            </div>
            <div className="flex items-center gap-3">
              <CreditBadge />
              <Link
                href="/run/new"
                className="px-6 py-2.5 rounded-lg bg-accent text-accent-foreground font-medium hover:opacity-90 transition-opacity duration-200 inline-flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                New Run
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Filter Toggle & Active Filters */}
        <div className="mb-6 space-y-4">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-muted hover:bg-border text-foreground text-sm font-medium transition-colors duration-200"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
              />
            </svg>
            Filters
            {activeFilterCount > 0 && (
              <span className="ml-1 px-2 py-0.5 rounded-full bg-accent text-accent-foreground text-xs font-semibold">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Filter Panel */}
          {showFilters && (
            <div className="p-6 rounded-lg bg-card border border-border animate-in fade-in duration-200">
              <RunFilter filters={filters} onFilterChange={setFilters} />
            </div>
          )}

          {/* Active Filters Display */}
          {activeFilterCount > 0 && (
            <div className="flex flex-wrap gap-2">
              {filters.status.map((s) => (
                <div key={`status-${s}`} className="filter-chip">
                  <span className="capitalize">{s}</span>
                  <button
                    onClick={() =>
                      setFilters({
                        ...filters,
                        status: filters.status.filter((x) => x !== s),
                      })
                    }
                    aria-label={`Remove ${s} filter`}
                  >
                    ✕
                  </button>
                </div>
              ))}
              {filters.persona.map((p) => (
                <div key={`persona-${p}`} className="filter-chip">
                  <span>{p.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}</span>
                  <button
                    onClick={() =>
                      setFilters({
                        ...filters,
                        persona: filters.persona.filter((x) => x !== p),
                      })
                    }
                    aria-label={`Remove ${p} filter`}
                  >
                    ✕
                  </button>
                </div>
              ))}
              {filters.url && (
                <div className="filter-chip">
                  <span className="truncate max-w-xs">{filters.url}</span>
                  <button
                    onClick={() => setFilters({ ...filters, url: '' })}
                    aria-label="Remove URL filter"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center space-y-3">
              <div className="inline-block animate-status-pulse">
                <svg
                  className="w-8 h-8 text-accent"
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
              <p className="text-muted-foreground">Loading runs...</p>
            </div>
          </div>
        )}

        {/* Table */}
        {!loading && (
          <div className="rounded-lg border border-border overflow-hidden bg-card">
            {filteredRuns.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-4">
                <svg
                  className="w-12 h-12 text-muted-foreground mb-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                  />
                </svg>
                <p className="text-muted-foreground">
                  {runs.length === 0 ? 'No runs yet' : 'No runs match your filters'}
                </p>
                {runs.length === 0 && (
                  <Link
                    href="/run/new"
                    className="mt-4 text-accent hover:underline text-sm font-medium"
                  >
                    Create your first run
                  </Link>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted border-b border-border">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        URL
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Persona
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Started
                      </th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredRuns.map((run) => (
                      <tr
                        key={run.runId}
                        onClick={() => handleRowClick(run)}
                        className="hover:bg-muted/50 cursor-pointer transition-colors duration-150"
                      >
                        <td className="px-6 py-4 text-sm font-mono text-foreground">
                          <div className="truncate max-w-xs" title={run.url}>
                            {run.url}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-muted-foreground">
                          {run.personaId.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                        </td>
                        <td className="px-6 py-4">
                          <StatusBadge status={run.status as any} />
                        </td>
                        <td className="px-6 py-4 text-sm text-muted-foreground">
                          {new Date(run.startedAt).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="text-sm font-medium text-accent hover:text-accent/80 transition-colors duration-150">
                            {run.status === 'complete' ? 'View Reports' : 'Monitor'}
                            <svg className="w-4 h-4 inline ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
