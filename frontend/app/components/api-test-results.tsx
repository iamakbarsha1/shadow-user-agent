'use client';

import { useState } from 'react';

/** Represents the result of testing a single API endpoint. */
export interface ApiTestResult {
  endpoint: string;
  operationId?: string;
  status: number;
  responseTime: number;
  passed: boolean;
  failureReason?: string;
  expectedStatuses: number[];
}

interface ApiTestResultsProps {
  results: ApiTestResult[];
}

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | string;

const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-blue-900/60 text-blue-300 border-blue-700',
  POST: 'bg-green-900/60 text-green-300 border-green-700',
  PUT: 'bg-yellow-900/60 text-yellow-300 border-yellow-700',
  DELETE: 'bg-red-900/60 text-red-300 border-red-700',
  PATCH: 'bg-orange-900/60 text-orange-300 border-orange-700',
};

function parseEndpoint(endpoint: string): { method: HttpMethod; path: string } {
  const [method, ...rest] = endpoint.split(' ');
  if (rest.length > 0) {
    return { method: method.toUpperCase(), path: rest.join(' ') };
  }
  // Fallback: treat whole string as path with unknown method
  return { method: 'GET', path: endpoint };
}

function MethodBadge({ method }: { method: HttpMethod }): JSX.Element {
  const colorClass = METHOD_COLORS[method] ?? 'bg-muted text-muted-foreground border-border';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-bold border ${colorClass}`}>
      {method}
    </span>
  );
}

/**
 * Displays a pass/fail summary table for API test results.
 * Shows per-endpoint status, response time, and expandable failure details.
 */
export function ApiTestResults({ results }: ApiTestResultsProps): JSX.Element {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  if (results.length === 0) {
    return (
      <div className="p-8 rounded-lg bg-card border border-border text-center">
        <p className="text-muted-foreground">No API test results yet</p>
      </div>
    );
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.length - passed;

  const toggleExpand = (index: number): void => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="p-4 rounded-lg bg-card border border-border">
        <div className="flex items-center gap-6">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Total Endpoints</p>
            <p className="text-2xl font-bold text-foreground">{results.length}</p>
          </div>
          <div className="w-px h-10 bg-border" />
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Passed</p>
            <p className="text-2xl font-bold text-green-400">{passed}</p>
          </div>
          <div className="w-px h-10 bg-border" />
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Failed</p>
            <p className="text-2xl font-bold text-red-400">{failed}</p>
          </div>
          <div className="ml-auto">
            <div className="flex items-center gap-2">
              <div className="w-32 h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-green-500 transition-all duration-500"
                  style={{ width: `${results.length > 0 ? (passed / results.length) * 100 : 0}%` }}
                />
              </div>
              <span className="text-sm font-medium text-foreground">
                {results.length > 0 ? Math.round((passed / results.length) * 100) : 0}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Results table */}
      <div className="rounded-lg bg-card border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">
                Method + Path
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">
                Response Time
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">
                Result
              </th>
            </tr>
          </thead>
          <tbody>
            {results.map((result, index) => {
              const { method, path } = parseEndpoint(result.endpoint);
              const isExpanded = expandedIndex === index;
              const isLast = index === results.length - 1;

              return (
                <>
                  <tr
                    key={`row-${index}`}
                    className={`${!isLast || isExpanded ? 'border-b border-border' : ''} ${
                      !result.passed ? 'cursor-pointer hover:bg-muted/30 transition-colors duration-150' : ''
                    }`}
                    onClick={() => !result.passed && toggleExpand(index)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <MethodBadge method={method} />
                        <span className="font-mono text-foreground truncate max-w-xs" title={path}>
                          {path}
                        </span>
                        {result.operationId && (
                          <span className="text-xs text-muted-foreground hidden lg:inline">
                            ({result.operationId})
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-foreground">{result.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-foreground">{result.responseTime}ms</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {result.passed ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-900/50 text-green-300 border border-green-700">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path
                                fillRule="evenodd"
                                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                clipRule="evenodd"
                              />
                            </svg>
                            Pass
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-900/50 text-red-300 border border-red-700">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path
                                fillRule="evenodd"
                                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                                clipRule="evenodd"
                              />
                            </svg>
                            Fail
                          </span>
                        )}
                        {!result.passed && (
                          <svg
                            className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        )}
                      </div>
                    </td>
                  </tr>
                  {/* Expandable failure detail row */}
                  {isExpanded && !result.passed && (
                    <tr key={`detail-${index}`} className={`bg-red-950/20 ${!isLast ? 'border-b border-border' : ''}`}>
                      <td colSpan={4} className="px-6 py-4">
                        <div className="space-y-2 text-sm">
                          {result.failureReason && (
                            <div>
                              <span className="font-semibold text-red-300">Failure reason: </span>
                              <span className="text-red-200">{result.failureReason}</span>
                            </div>
                          )}
                          {result.expectedStatuses.length > 0 && (
                            <div>
                              <span className="font-semibold text-muted-foreground">Expected statuses: </span>
                              <span className="text-foreground">
                                {result.expectedStatuses.join(', ')}
                              </span>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
