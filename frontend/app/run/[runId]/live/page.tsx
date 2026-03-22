'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '../../../../lib/api';

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
  }, [runId]);

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading run...</p>
        </div>
      </main>
    );
  }

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'complete':
        return 'text-green-600';
      case 'running':
        return 'text-blue-600';
      case 'pending':
        return 'text-yellow-600';
      case 'failed':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">Live Monitor</h1>

        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <div>
            <h2 className="text-sm font-medium text-gray-500">Run ID</h2>
            <p className="text-lg font-mono">{run?.runId}</p>
          </div>

          <div>
            <h2 className="text-sm font-medium text-gray-500">Status</h2>
            <p className={`text-2xl font-bold ${getStatusColor(run?.status ?? '')}`}>
              {run?.status?.toUpperCase()}
              {run?.status === 'running' && <span className="ml-2 animate-pulse">&#x25CF;</span>}
            </p>
          </div>

          <div>
            <h2 className="text-sm font-medium text-gray-500">Target URL</h2>
            <p className="text-lg">{run?.url}</p>
          </div>

          <div>
            <h2 className="text-sm font-medium text-gray-500">Persona</h2>
            <p className="text-lg capitalize">{run?.personaId?.replace('_', ' ')}</p>
          </div>

          <div>
            <h2 className="text-sm font-medium text-gray-500">Observations</h2>
            <p className="text-3xl font-bold">{run?.observationCount ?? 0}</p>
          </div>

          {run?.status === 'complete' && (
            <div className="mt-6 p-4 bg-green-50 rounded-lg">
              <p className="text-green-800 font-medium">
                Run completed! Found {run.observationCount} observations.
              </p>
              <p className="text-green-600 text-sm mt-2">
                Reports generated: {run.reportIds?.length ?? 0}
              </p>
              <Link
                href={`/reports/${runId}`}
                className="inline-block mt-3 px-4 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700"
              >
                View Reports
              </Link>
            </div>
          )}

          {run?.status === 'failed' && (
            <div className="mt-6 p-4 bg-red-50 rounded-lg">
              <p className="text-red-800 font-medium">Run failed</p>
            </div>
          )}
        </div>

        <div className="mt-6">
          <Link
            href="/"
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
