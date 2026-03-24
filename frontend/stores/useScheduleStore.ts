import { create } from 'zustand';
import { api, type Schedule } from '../lib/api';

interface ScheduleState {
  schedules: Schedule[];
  loading: boolean;
  error: string | null;
  loadSchedules: () => Promise<void>;
  createSchedule: (data: {
    url: string;
    personaId: string;
    cronExpression: string;
    label?: string;
    generateTests?: boolean;
  }) => Promise<Schedule>;
  toggleEnabled: (id: string, enabled: boolean) => Promise<void>;
  deleteSchedule: (id: string) => Promise<void>;
  clear: () => void;
}

export const useScheduleStore = create<ScheduleState>((set, get) => ({
  schedules: [],
  loading: false,
  error: null,

  loadSchedules: async () => {
    set({ loading: true, error: null });
    try {
      const response = await api.listSchedules();
      set({ schedules: response.schedules, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  createSchedule: async (data) => {
    const schedule = await api.createSchedule(data);
    set((state) => ({ schedules: [schedule, ...state.schedules] }));
    return schedule;
  },

  toggleEnabled: async (id: string, enabled: boolean) => {
    const updated = await api.updateSchedule(id, { enabled });
    set((state) => ({
      schedules: state.schedules.map((s) => (s.id === id ? updated : s)),
    }));
  },

  deleteSchedule: async (id: string) => {
    await api.deleteSchedule(id);
    set((state) => ({
      schedules: state.schedules.filter((s) => s.id !== id),
    }));
  },

  clear: () => set({ schedules: [], error: null, loading: false }),
}));
