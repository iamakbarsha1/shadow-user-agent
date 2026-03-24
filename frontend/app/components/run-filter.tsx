'use client';

import { useState } from 'react';

export interface FilterState {
  status: string[];
  persona: string[];
  url: string;
}

interface RunFilterProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
}

const statuses = ['complete', 'running', 'pending', 'failed'];
const personas = ['new_user', 'power_user', 'mobile_user', 'edge_case'];

export function RunFilter({ filters, onFilterChange }: RunFilterProps): JSX.Element {
  const [urlInput, setUrlInput] = useState(filters.url);

  const toggleStatus = (s: string) => {
    const newStatus = filters.status.includes(s)
      ? filters.status.filter((x) => x !== s)
      : [...filters.status, s];
    onFilterChange({ ...filters, status: newStatus });
  };

  const togglePersona = (p: string) => {
    const newPersona = filters.persona.includes(p)
      ? filters.persona.filter((x) => x !== p)
      : [...filters.persona, p];
    onFilterChange({ ...filters, persona: newPersona });
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUrlInput(e.target.value);
    onFilterChange({ ...filters, url: e.target.value });
  };

  const clearAll = () => {
    setUrlInput('');
    onFilterChange({ status: [], persona: [], url: '' });
  };

  const hasActiveFilters = filters.status.length > 0 || filters.persona.length > 0 || filters.url;

  return (
    <div className="space-y-4">
      {/* Search by URL */}
      <div>
        <label className="block text-sm font-medium text-muted-foreground mb-2">Search URL</label>
        <input
          type="text"
          placeholder="Filter by URL..."
          value={urlInput}
          onChange={handleUrlChange}
          className="w-full px-4 py-2.5 rounded-lg bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all duration-200"
        />
      </div>

      {/* Status Filter */}
      <div>
        <label className="block text-sm font-medium text-muted-foreground mb-2">Status</label>
        <div className="flex flex-wrap gap-2">
          {statuses.map((s) => (
            <button
              key={s}
              onClick={() => toggleStatus(s)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                filters.status.includes(s)
                  ? 'bg-accent text-accent-foreground ring-2 ring-accent ring-offset-2'
                  : 'bg-muted text-muted-foreground hover:bg-border hover:text-foreground'
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Persona Filter */}
      <div>
        <label className="block text-sm font-medium text-muted-foreground mb-2">Persona</label>
        <div className="flex flex-wrap gap-2">
          {personas.map((p) => (
            <button
              key={p}
              onClick={() => togglePersona(p)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                filters.persona.includes(p)
                  ? 'bg-accent text-accent-foreground ring-2 ring-accent ring-offset-2'
                  : 'bg-muted text-muted-foreground hover:bg-border hover:text-foreground'
              }`}
            >
              {p.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Clear Filters */}
      {hasActiveFilters && (
        <button
          onClick={clearAll}
          className="w-full px-4 py-2 rounded-lg bg-muted text-muted-foreground hover:bg-border hover:text-foreground text-sm font-medium transition-all duration-150"
        >
          Clear Filters
        </button>
      )}
    </div>
  );
}
