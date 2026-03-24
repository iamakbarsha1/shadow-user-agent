'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useScheduleStore } from '../../stores/useScheduleStore';
import { CronInput } from '../components/cron-input';
import type { Schedule } from '../../lib/api';

const PERSONAS = [
  { id: 'new_user', label: 'New User' },
  { id: 'power_user', label: 'Power User' },
  { id: 'mobile_user', label: 'Mobile User' },
  { id: 'edge_case', label: 'Edge Case' },
];

function ScheduleRow({
  schedule,
  onToggle,
  onDelete,
}: {
  schedule: Schedule;
  onToggle: (id: string, enabled: boolean) => void;
  onDelete: (id: string) => void;
}): JSX.Element {
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleToggle = async () => {
    setToggling(true);
    try {
      onToggle(schedule.id, !schedule.enabled);
    } finally {
      setToggling(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete schedule "${schedule.label ?? schedule.url}"?`)) return;
    setDeleting(true);
    try {
      onDelete(schedule.id);
    } finally {
      setDeleting(false);
    }
  };

  const persona = PERSONAS.find((p) => p.id === schedule.personaId)?.label ?? schedule.personaId;

  return (
    <div className="flex items-start gap-4 p-4 border border-border rounded-xl bg-card hover:bg-muted/30 transition-colors">
      {/* Toggle */}
      <button
        type="button"
        onClick={handleToggle}
        disabled={toggling}
        aria-label={schedule.enabled ? 'Disable schedule' : 'Enable schedule'}
        className={`mt-0.5 relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50
          ${schedule.enabled ? 'bg-primary' : 'bg-muted'}`}
      >
        <span
          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out
            ${schedule.enabled ? 'translate-x-4' : 'translate-x-0'}`}
        />
      </button>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {schedule.label && (
            <span className="font-medium text-sm text-foreground">{schedule.label}</span>
          )}
          <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded text-muted-foreground">
            {schedule.cronExpression}
          </span>
          <span className="text-xs bg-muted px-2 py-0.5 rounded text-muted-foreground">
            {persona}
          </span>
          {schedule.generateTests && (
            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
              + tests
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground truncate mt-0.5">{schedule.url}</p>
        <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
          {schedule.lastRunAt && (
            <span>Last run: {new Date(schedule.lastRunAt).toLocaleString()}</span>
          )}
          {!schedule.lastRunAt && <span>Never run</span>}
        </div>
      </div>

      {/* Delete */}
      <button
        type="button"
        onClick={handleDelete}
        disabled={deleting}
        aria-label="Delete schedule"
        className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors disabled:opacity-50"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  );
}

function CreateScheduleForm({ onCreated }: { onCreated: () => void }): JSX.Element {
  const { createSchedule } = useScheduleStore();
  const [url, setUrl] = useState('');
  const [personaId, setPersonaId] = useState('new_user');
  const [cron, setCron] = useState('0 * * * *');
  const [label, setLabel] = useState('');
  const [generateTests, setGenerateTests] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await createSchedule({
        url,
        personaId,
        cronExpression: cron,
        label: label || undefined,
        generateTests,
      });
      setUrl('');
      setLabel('');
      setCron('0 * * * *');
      onCreated();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const parts = cron.trim().split(/\s+/);
  const cronValid = parts.length >= 5 && parts.length <= 6;

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 border border-border rounded-xl bg-card">
      <h3 className="font-semibold text-sm text-foreground">New Schedule</h3>

      <div>
        <label className="block text-xs text-muted-foreground mb-1">URL *</label>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://your-app.com"
          required
          className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Persona</label>
          <select
            value={personaId}
            onChange={(e) => setPersonaId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {PERSONAS.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Label (optional)</label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Nightly check"
            maxLength={100}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs text-muted-foreground mb-1">Cron Expression *</label>
        <CronInput value={cron} onChange={setCron} />
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={generateTests}
          onChange={(e) => setGenerateTests(e.target.checked)}
          className="rounded border-border"
        />
        <span className="text-sm text-foreground">Generate tests after each run</span>
      </label>

      {error && (
        <p className="text-sm text-red-500 bg-red-50 dark:bg-red-950/30 px-3 py-2 rounded-lg">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading || !url || !cronValid}
        className="w-full py-2 px-4 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? 'Creating…' : 'Create Schedule'}
      </button>
    </form>
  );
}

export default function SchedulesPage(): JSX.Element {
  const { schedules, loading, error, loadSchedules, toggleEnabled, deleteSchedule } =
    useScheduleStore();
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    void loadSchedules();
  }, []);

  const enabled = schedules.filter((s) => s.enabled);
  const disabled = schedules.filter((s) => !s.enabled);

  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-card border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 className="text-sm font-semibold text-foreground">Scheduled Monitoring</h1>
              <p className="text-xs text-muted-foreground">
                {enabled.length} active · {schedules.length} total
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {showForm ? 'Cancel' : 'New Schedule'}
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Create form */}
        {showForm && (
          <CreateScheduleForm
            onCreated={() => setShowForm(false)}
          />
        )}

        {/* Error */}
        {error && (
          <div className="p-4 border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900 rounded-xl text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && schedules.length === 0 && (
          <div className="text-center py-16">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-sm text-muted-foreground">No schedules yet.</p>
            <p className="text-xs text-muted-foreground mt-1">Create one to start recurring monitoring.</p>
          </div>
        )}

        {/* Active schedules */}
        {!loading && enabled.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Active ({enabled.length})
            </h2>
            <div className="space-y-2">
              {enabled.map((s) => (
                <ScheduleRow
                  key={s.id}
                  schedule={s}
                  onToggle={toggleEnabled}
                  onDelete={deleteSchedule}
                />
              ))}
            </div>
          </section>
        )}

        {/* Disabled schedules */}
        {!loading && disabled.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Paused ({disabled.length})
            </h2>
            <div className="space-y-2">
              {disabled.map((s) => (
                <ScheduleRow
                  key={s.id}
                  schedule={s}
                  onToggle={toggleEnabled}
                  onDelete={deleteSchedule}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
