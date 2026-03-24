'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useRunFormStore } from '../../../stores/useRunFormStore';
import { PersonaCard } from '../../components/persona-card';
import { Slider } from '../../components/slider';
import { PersonaIcons } from '../../components/persona-icons';
import { ApiSpecUpload } from '../../components/api-spec-upload';

const PERSONAS = [
  {
    id: 'new_user',
    label: 'New User',
    description: 'First-time visitor, explores slowly, aborts on errors',
  },
  {
    id: 'power_user',
    label: 'Power User',
    description: 'Fast navigation, expects instant responses',
  },
  {
    id: 'mobile_user',
    label: 'Mobile User',
    description: 'iPhone 14 viewport, sensitive to layout issues',
  },
  {
    id: 'edge_case',
    label: 'Edge-Case User',
    description: 'Stress tests with special characters and edge cases',
  },
  {
    id: 'security_scanner',
    label: 'Security Scanner',
    description: 'Probes for XSS, CSRF, insecure headers, cookie flags, and redirect vulnerabilities',
  },
];

export default function NewRun(): JSX.Element {
  const router = useRouter();
  const {
    url,
    personaId,
    maxSteps,
    runType,
    apiSpec,
    setUrl,
    setPersonaId,
    setMaxSteps,
    setRunType,
    setApiSpec,
    submit,
  } = useRunFormStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isApiMode = runType === 'api';

  const isSubmitDisabled = loading || !url || (isApiMode ? !apiSpec : !personaId);

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
    <main className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-card border-b border-border">
        <div className="max-w-5xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Create New Run</h1>
              <p className="text-muted-foreground text-sm mt-1">Configure and start a new agent run</p>
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

      <div className="max-w-5xl mx-auto px-6 py-12">
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-8">

          {/* Run Type Toggle */}
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">
                Test Type
              </label>
              <p className="text-sm text-muted-foreground mb-4">
                Choose whether to test a web UI with a browser agent or a backend API with an HTTP agent
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setRunType('browser')}
                className={`p-4 rounded-lg border text-left transition-all duration-200 ${
                  runType === 'browser'
                    ? 'border-accent bg-accent/10 text-foreground'
                    : 'border-border bg-card text-muted-foreground hover:border-accent/50'
                }`}
              >
                <div className="font-semibold text-sm mb-1">Browser Agent</div>
                <div className="text-xs">Simulates real user behavior with Playwright</div>
              </button>
              <button
                type="button"
                onClick={() => setRunType('api')}
                className={`p-4 rounded-lg border text-left transition-all duration-200 ${
                  runType === 'api'
                    ? 'border-accent bg-accent/10 text-foreground'
                    : 'border-border bg-card text-muted-foreground hover:border-accent/50'
                }`}
              >
                <div className="font-semibold text-sm mb-1">API Agent</div>
                <div className="text-xs">Tests HTTP endpoints from an OpenAPI spec</div>
              </button>
            </div>
          </div>

          {/* URL Input Section */}
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">
                {isApiMode ? 'Base URL' : 'Target URL'}
              </label>
              <p className="text-sm text-muted-foreground mb-4">
                {isApiMode
                  ? 'Enter the base URL of the API you want to test'
                  : 'Enter the URL of the application you want to test'}
              </p>
            </div>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={isApiMode ? 'https://api.yourapp.com' : 'https://your-app.com'}
              required
              className="w-full px-4 py-3 rounded-lg bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all duration-200"
            />
          </div>

          {/* API Spec Upload — only shown in API mode */}
          {isApiMode && (
            <div className="p-6 rounded-lg bg-card border border-border">
              <ApiSpecUpload value={apiSpec} onChange={setApiSpec} />
            </div>
          )}

          {/* Persona Selector Section — only shown in browser mode */}
          {!isApiMode && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">
                  Select Persona
                </label>
                <p className="text-sm text-muted-foreground mb-4">
                  Choose how the agent should behave during the test run
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {PERSONAS.map((persona) => (
                  <PersonaCard
                    key={persona.id}
                    id={persona.id}
                    label={persona.label}
                    description={persona.description}
                    isSelected={personaId === persona.id}
                    onClick={() => setPersonaId(persona.id)}
                    icon={PersonaIcons[persona.id as keyof typeof PersonaIcons]}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Max Steps Section — only shown in browser mode */}
          {!isApiMode && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">
                  Interaction Limit
                </label>
                <p className="text-sm text-muted-foreground mb-4">
                  How many steps should the agent take before stopping (higher = more thorough)
                </p>
              </div>
              <div className="p-6 rounded-lg bg-card border border-border">
                <Slider
                  min={10}
                  max={100}
                  value={maxSteps}
                  onChange={setMaxSteps}
                  step={5}
                />
              </div>
            </div>
          )}

          {/* Error Alert */}
          {error && (
            <div className="p-4 rounded-lg bg-red-950 text-red-200 border border-red-800 animate-in fade-in duration-200">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
                <div>
                  <h3 className="font-semibold">Error starting run</h3>
                  <p className="text-sm mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Form Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={isSubmitDisabled}
              className="flex-1 px-6 py-3 rounded-lg bg-accent text-accent-foreground font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 inline-flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" strokeWidth="2" strokeOpacity="0.3" />
                    <path
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Starting...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  Start Agent Run
                </>
              )}
            </button>
            <Link
              href="/"
              className="px-6 py-3 rounded-lg bg-muted text-foreground font-medium hover:bg-border transition-colors duration-200"
            >
              Cancel
            </Link>
          </div>
        </form>

        {/* Tips Section */}
        <div className="mt-12 p-6 rounded-lg bg-muted border border-border">
          <h3 className="font-semibold text-foreground mb-3">Tips for best results</h3>
          {isApiMode ? (
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-accent mt-0.5">→</span>
                <span>Provide a complete OpenAPI 3.x or Swagger 2.0 JSON spec for best coverage</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-accent mt-0.5">→</span>
                <span>The agent tests every endpoint defined in your spec and reports unexpected status codes</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-accent mt-0.5">→</span>
                <span>Use the base URL that matches your spec&apos;s server entry (e.g. https://api.yourapp.com)</span>
              </li>
            </ul>
          ) : (
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-accent mt-0.5">→</span>
                <span>Test with different personas to catch persona-specific bugs</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-accent mt-0.5">→</span>
                <span>Higher step counts allow more thorough exploration but take longer</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-accent mt-0.5">→</span>
                <span>The agent will generate a detailed bug report and UX friction analysis</span>
              </li>
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}
