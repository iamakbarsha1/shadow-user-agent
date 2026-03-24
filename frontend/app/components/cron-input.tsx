'use client';

import { useState } from 'react';

const PRESETS = [
  { label: 'Every hour', value: '0 * * * *' },
  { label: 'Every 6 hours', value: '0 */6 * * *' },
  { label: 'Every 12 hours', value: '0 */12 * * *' },
  { label: 'Daily at midnight', value: '0 0 * * *' },
  { label: 'Daily at 9am', value: '0 9 * * *' },
  { label: 'Weekly (Mon 9am)', value: '0 9 * * 1' },
];

interface CronInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

export function CronInput({ value, onChange, error }: CronInputProps): JSX.Element {
  const [showPresets, setShowPresets] = useState(false);

  const parts = value.trim().split(/\s+/);
  const isValid = parts.length >= 5 && parts.length <= 6;

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0 * * * *"
          className={`flex-1 px-3 py-2 rounded-lg border bg-background text-sm font-mono
            ${error || (value && !isValid)
              ? 'border-red-500 focus:ring-red-500'
              : 'border-border focus:ring-primary'
            } focus:outline-none focus:ring-2`}
          aria-label="Cron expression"
        />
        <button
          type="button"
          onClick={() => setShowPresets((v) => !v)}
          className="px-3 py-2 text-sm rounded-lg border border-border bg-muted hover:bg-muted/80 transition-colors"
        >
          Presets
        </button>
      </div>

      {showPresets && (
        <div className="border border-border rounded-lg bg-card shadow-sm divide-y divide-border">
          {PRESETS.map((preset) => (
            <button
              key={preset.value}
              type="button"
              onClick={() => {
                onChange(preset.value);
                setShowPresets(false);
              }}
              className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-muted/50 transition-colors text-left first:rounded-t-lg last:rounded-b-lg"
            >
              <span className="font-medium">{preset.label}</span>
              <span className="text-muted-foreground font-mono text-xs">{preset.value}</span>
            </button>
          ))}
        </div>
      )}

      {value && !isValid && (
        <p className="text-xs text-red-500">
          Must be 5–6 space-separated fields (e.g. <code>0 * * * *</code>)
        </p>
      )}
      {error && <p className="text-xs text-red-500">{error}</p>}
      {value && isValid && (
        <p className="text-xs text-muted-foreground">
          Fields: minute hour day-of-month month day-of-week
        </p>
      )}
    </div>
  );
}
