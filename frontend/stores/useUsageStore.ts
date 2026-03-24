import { create } from 'zustand';
import { api, type UsageSummary, type CreditAllocation } from '../lib/api';

interface UsageState {
  summary: UsageSummary | null;
  loading: boolean;
  error: string | null;
  loadUsage: () => Promise<void>;
  resetUsage: () => Promise<void>;
  clear: () => void;
}

export const useUsageStore = create<UsageState>((set) => ({
  summary: null,
  loading: false,
  error: null,

  loadUsage: async () => {
    set({ loading: true, error: null });
    try {
      const summary = await api.getUsage();
      set({ summary, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  resetUsage: async () => {
    await api.resetUsage();
    const summary = await api.getUsage();
    set({ summary });
  },

  clear: () => set({ summary: null, error: null, loading: false }),
}));

/** Selector: just the allocation (for CreditBadge) */
export function selectAllocation(state: UsageState): CreditAllocation | null {
  return state.summary?.allocation ?? null;
}
