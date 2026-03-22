import { create } from 'zustand';
import { api } from '../lib/api';

interface Run {
  runId: string;
  url: string;
  personaId: string;
  status: 'pending' | 'running' | 'complete' | 'failed';
  startedAt: string;
  completedAt?: string;
}

interface RunStore {
  runs: Run[];
  loading: boolean;
  error: string | null;
  loadRuns: () => Promise<void>;
  deleteRun: (runId: string) => Promise<void>;
}

export const useRunStore = create<RunStore>((set, get) => ({
  runs: [],
  loading: false,
  error: null,

  loadRuns: async () => {
    set({ loading: true, error: null });
    try {
      const data = await api.listRuns({ limit: 50 });
      set({ runs: data.runs, loading: false });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  deleteRun: async (runId: string) => {
    try {
      await api.deleteRun(runId);
      set({ runs: get().runs.filter((r) => r.runId !== runId) });
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },
}));
