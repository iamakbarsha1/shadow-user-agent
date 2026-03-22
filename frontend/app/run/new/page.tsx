'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useRunFormStore } from '../../../stores/useRunFormStore';

const PERSONAS = [
  {
    id: 'new_user',
    label: 'New User',
    description: 'First-time visitor, explores slowly, aborts on errors',
    icon: '🆕',
  },
  {
    id: 'power_user',
    label: 'Power User',
    description: 'Fast navigation, expects instant responses',
    icon: '⚡',
  },
  {
    id: 'mobile_user',
    label: 'Mobile User',
    description: 'iPhone 14 viewport, sensitive to layout issues',
    icon: '📱',
  },
  {
    id: 'edge_case',
    label: 'Edge-Case User',
    description: 'Stress tests with special characters and edge cases',
    icon: '🔧',
  },
];

export default function NewRun(): JSX.Element {
  const router = useRouter();
  const { url, personaId, maxSteps, setUrl, setPersonaId, setMaxSteps, submit } = useRunFormStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const runId = await submit();
      router.push(`/run/${runId}/live`);
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">New Agent Run</h1>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-8">
          {/* URL Input */}
          <div className="bg-white rounded-lg shadow p-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Target URL
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://your-app.com"
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Persona Selector */}
          <div className="bg-white rounded-lg shadow p-6">
            <label className="block text-sm font-medium text-gray-700 mb-4">
              Select Persona
            </label>
            <div className="grid grid-cols-2 gap-4">
              {PERSONAS.map((persona) => (
                <button
                  key={persona.id}
                  type="button"
                  onClick={() => setPersonaId(persona.id)}
                  className={`p-4 border-2 rounded-lg text-left transition ${
                    personaId === persona.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{persona.icon}</span>
                    <div>
                      <h3 className="font-semibold">{persona.label}</h3>
                      <p className="text-sm text-gray-600 mt-1">{persona.description}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Max Steps */}
          <div className="bg-white rounded-lg shadow p-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Max Steps: {maxSteps}
            </label>
            <input
              type="range"
              min="10"
              max="100"
              value={maxSteps}
              onChange={(e) => setMaxSteps(parseInt(e.target.value))}
              className="w-full"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !url}
            className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
          >
            {loading ? 'Starting...' : 'Start Agent'}
          </button>
        </form>
      </div>
    </main>
  );
}
