import { create } from 'zustand';
import { api } from '../lib/api';

interface Report {
  reportId: string;
  reportType: string;
  content: Record<string, unknown>;
  createdAt: string;
}

interface ReportStore {
  reports: Report[];
  loading: boolean;
  error: string | null;
  loadReports: (runId: string) => Promise<void>;
}

export const useReportStore = create<ReportStore>((set) => ({
  reports: [],
  loading: false,
  error: null,

  loadReports: async (runId: string) => {
    set({ loading: true, error: null });
    try {
      const data = await api.getReports(runId);
      set({ reports: data.reports, loading: false });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },
}));
