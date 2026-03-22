'use client';

import { useEffect } from 'react';
import { useRunStore } from '../stores/useRunStore';
import Link from 'next/link';

export default function Dashboard(): JSX.Element {
  const { runs, loading, loadRuns } = useRunStore();

  useEffect(() => {
    loadRuns();
  }, []);

  useEffect(() => {
    // Only poll if there are active runs
    if (!runs.some((r) => r.status === 'running' || r.status === 'pending')) {
      return;
    }

    const interval = setInterval(() => {
      loadRuns();
    }, 10000);

    return () => clearInterval(interval);
  }, [runs, loadRuns]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'complete':
        return 'bg-green-100 text-green-800';
      case 'running':
        return 'bg-blue-100 text-blue-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold">Shadow User Agent</h1>
          <Link
            href="/run/new"
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
          >
            New Run
          </Link>
        </div>

        {loading && <p>Loading runs...</p>}

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  URL
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Persona
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Started
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {runs.map((run) => (
                <tr key={run.runId} className="hover:bg-gray-50 cursor-pointer">
                  <td className="px-6 py-4 text-sm text-gray-900">{run.url}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{run.personaId}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${getStatusColor(run.status)}`}
                    >
                      {run.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(run.startedAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
