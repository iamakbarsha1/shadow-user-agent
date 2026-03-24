'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTestGroupStore } from '../../stores/useTestGroupStore';
import type { TestGroup, GroupExecutionResult } from '../../lib/api';

// ────────────────────────────────────────────────
// GroupExecutionStatus — shows results of a group run
// ────────────────────────────────────────────────
function GroupExecutionStatus({
  result,
  onClose,
}: {
  result: GroupExecutionResult;
  onClose: () => void;
}): JSX.Element {
  const statusColor = {
    passed: 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30',
    healed: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30',
    failed: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30',
    error: 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/30',
  };

  const allPassed = result.failed === 0;

  return (
    <div className="border border-border rounded-xl bg-card overflow-hidden">
      {/* Header */}
      <div className={`px-4 py-3 flex items-center justify-between ${allPassed ? 'bg-green-50 dark:bg-green-950/20 border-b border-green-200 dark:border-green-900' : 'bg-red-50 dark:bg-red-950/20 border-b border-red-200 dark:border-red-900'}`}>
        <div className="flex items-center gap-3">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center ${allPassed ? 'bg-green-100 dark:bg-green-900/40' : 'bg-red-100 dark:bg-red-900/40'}`}>
            {allPassed ? (
              <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{result.testGroupName} — Execution Complete</p>
            <p className="text-xs text-muted-foreground">
              {result.passed} passed · {result.healed} healed · {result.failed} failed · {result.total} total
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Results list */}
      <div className="divide-y divide-border">
        {result.results.map((r) => (
          <div key={r.testCaseId} className="flex items-center gap-3 px-4 py-2.5">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColor[r.status]}`}>
              {r.status}
            </span>
            <span className="text-sm text-foreground flex-1 min-w-0 truncate">{r.testCaseTitle}</span>
            <span className="text-xs text-muted-foreground shrink-0">{r.duration}ms</span>
            {r.healed && (
              <span className="text-xs bg-blue-100 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full shrink-0">
                auto-healed
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────
// TestGroupManager — single group card with member list
// ────────────────────────────────────────────────
function TestGroupManager({
  group,
  onDelete,
  onExecute,
  executing,
}: {
  group: TestGroup;
  onDelete: (id: string) => void;
  onExecute: (id: string) => void;
  executing: boolean;
}): JSX.Element {
  const { removeMember } = useTestGroupStore();
  const [removing, setRemoving] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);

  const members = group.memberships ?? [];

  const statusDot: Record<string, string> = {
    passing: 'bg-green-500',
    failing: 'bg-red-500',
    generated: 'bg-yellow-400',
    stale: 'bg-gray-400',
  };

  const handleRemove = async (testCaseId: string) => {
    setRemoving(testCaseId);
    try {
      await removeMember(group.id, testCaseId);
    } finally {
      setRemoving(null);
    }
  };

  return (
    <div className="border border-border rounded-xl bg-card overflow-hidden">
      {/* Group header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-muted/30">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="p-0.5 text-muted-foreground hover:text-foreground transition-colors"
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          <svg
            className={`w-4 h-4 transition-transform ${expanded ? 'rotate-90' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground truncate">{group.name}</span>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full shrink-0">
              {members.length} test{members.length !== 1 ? 's' : ''}
            </span>
            {group.runOnSchedule && (
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full shrink-0">
                scheduled
              </span>
            )}
          </div>
          {group.description && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">{group.description}</p>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Execute button */}
          <button
            type="button"
            onClick={() => onExecute(group.id)}
            disabled={executing || members.length === 0}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {executing ? (
              <>
                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Running…
              </>
            ) : (
              <>
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Run All
              </>
            )}
          </button>

          {/* Delete */}
          <button
            type="button"
            onClick={() => {
              if (confirm(`Delete group "${group.name}"?`)) onDelete(group.id);
            }}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
            aria-label="Delete group"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Members list */}
      {expanded && (
        <div>
          {members.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-muted-foreground">
              No tests in this group yet. Add test cases below.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {members.map((m) => {
                const tc = m.testCase;
                if (!tc) return null;
                return (
                  <div key={m.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20 transition-colors">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${statusDot[tc.status] ?? 'bg-gray-400'}`} />
                    <span className="text-sm text-foreground flex-1 min-w-0 truncate">{tc.title}</span>
                    <span className="text-xs text-muted-foreground shrink-0">{tc.status}</span>
                    <button
                      type="button"
                      onClick={() => handleRemove(tc.id)}
                      disabled={removing === tc.id}
                      className="p-1 rounded text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors disabled:opacity-50 shrink-0"
                      aria-label="Remove from group"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────
// CreateGroupForm
// ────────────────────────────────────────────────
function CreateGroupForm({ onCreated }: { onCreated: () => void }): JSX.Element {
  const { createTestGroup } = useTestGroupStore();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [runOnSchedule, setRunOnSchedule] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await createTestGroup({ name, description: description || undefined, runOnSchedule });
      setName('');
      setDescription('');
      setRunOnSchedule(false);
      onCreated();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 border border-border rounded-xl bg-card">
      <h3 className="font-semibold text-sm text-foreground">New Test Group</h3>

      <div>
        <label className="block text-xs text-muted-foreground mb-1">Name *</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Checkout Flow"
          required
          maxLength={200}
          className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      <div>
        <label className="block text-xs text-muted-foreground mb-1">Description (optional)</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What does this group test?"
          maxLength={500}
          className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={runOnSchedule}
          onChange={(e) => setRunOnSchedule(e.target.checked)}
          className="rounded border-border"
        />
        <span className="text-sm text-foreground">Include in scheduled runs</span>
      </label>

      {error && (
        <p className="text-sm text-red-500 bg-red-50 dark:bg-red-950/30 px-3 py-2 rounded-lg">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading || !name.trim()}
        className="w-full py-2 px-4 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? 'Creating…' : 'Create Group'}
      </button>
    </form>
  );
}

// ────────────────────────────────────────────────
// Main page
// ────────────────────────────────────────────────
export default function TestGroupsPage(): JSX.Element {
  const { testGroups, loading, error, executionResult, executing, loadTestGroups, deleteTestGroup, executeGroup, clearExecution } =
    useTestGroupStore();
  const [showForm, setShowForm] = useState(false);
  const [execError, setExecError] = useState<string | null>(null);

  useEffect(() => {
    void loadTestGroups();
  }, []);

  const handleExecute = async (groupId: string) => {
    setExecError(null);
    try {
      await executeGroup(groupId);
    } catch (err) {
      setExecError((err as Error).message);
    }
  };

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
              <h1 className="text-sm font-semibold text-foreground">Test Groups</h1>
              <p className="text-xs text-muted-foreground">
                {testGroups.length} group{testGroups.length !== 1 ? 's' : ''}
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
            {showForm ? 'Cancel' : 'New Group'}
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        {/* Create form */}
        {showForm && <CreateGroupForm onCreated={() => setShowForm(false)} />}

        {/* Execution result */}
        {executionResult && (
          <GroupExecutionStatus result={executionResult} onClose={clearExecution} />
        )}

        {/* Exec error */}
        {execError && (
          <div className="p-4 border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900 rounded-xl text-sm text-red-600 dark:text-red-400">
            {execError}
          </div>
        )}

        {/* Load error */}
        {error && (
          <div className="p-4 border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900 rounded-xl text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Loading skeletons */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && testGroups.length === 0 && (
          <div className="text-center py-16">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <p className="text-sm text-muted-foreground">No test groups yet.</p>
            <p className="text-xs text-muted-foreground mt-1">Create a group to organize and run tests together.</p>
          </div>
        )}

        {/* Group cards */}
        {!loading && testGroups.map((group) => (
          <TestGroupManager
            key={group.id}
            group={group}
            onDelete={deleteTestGroup}
            onExecute={handleExecute}
            executing={executing === group.id}
          />
        ))}
      </div>
    </main>
  );
}
