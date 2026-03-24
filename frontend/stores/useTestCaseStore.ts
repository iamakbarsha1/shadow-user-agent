import { create } from 'zustand';
import { api, type TestCase } from '../lib/api';

interface TestCaseState {
  testCases: TestCase[];
  loading: boolean;
  error: string | null;
  loadTestCases: (runId: string) => Promise<void>;
  deleteTestCase: (id: string) => Promise<void>;
  clear: () => void;
}

export const useTestCaseStore = create<TestCaseState>((set) => ({
  testCases: [],
  loading: false,
  error: null,

  loadTestCases: async (runId: string) => {
    set({ loading: true, error: null });
    try {
      const response = await api.listTestCases(runId);
      set({ testCases: response.testCases, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  deleteTestCase: async (id: string) => {
    await api.deleteTestCase(id);
    set((state) => ({
      testCases: state.testCases.filter((tc) => tc.id !== id),
    }));
  },

  clear: () => set({ testCases: [], error: null, loading: false }),
}));
