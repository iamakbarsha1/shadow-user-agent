import { create } from 'zustand';
import { api, type TestGroup, type GroupExecutionResult } from '../lib/api';

interface TestGroupState {
  testGroups: TestGroup[];
  loading: boolean;
  error: string | null;
  executionResult: GroupExecutionResult | null;
  executing: string | null; // groupId currently being executed
  loadTestGroups: () => Promise<void>;
  createTestGroup: (data: { name: string; description?: string; runOnSchedule?: boolean }) => Promise<TestGroup>;
  updateTestGroup: (id: string, data: { name?: string; description?: string; runOnSchedule?: boolean }) => Promise<void>;
  deleteTestGroup: (id: string) => Promise<void>;
  addMember: (groupId: string, testCaseId: string) => Promise<void>;
  removeMember: (groupId: string, testCaseId: string) => Promise<void>;
  executeGroup: (groupId: string) => Promise<GroupExecutionResult>;
  clearExecution: () => void;
  clear: () => void;
}

export const useTestGroupStore = create<TestGroupState>((set, get) => ({
  testGroups: [],
  loading: false,
  error: null,
  executionResult: null,
  executing: null,

  loadTestGroups: async () => {
    set({ loading: true, error: null });
    try {
      const response = await api.listTestGroups();
      set({ testGroups: response.testGroups, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  createTestGroup: async (data) => {
    const group = await api.createTestGroup(data);
    set((state) => ({ testGroups: [group, ...state.testGroups] }));
    return group;
  },

  updateTestGroup: async (id, data) => {
    const updated = await api.updateTestGroup(id, data);
    set((state) => ({
      testGroups: state.testGroups.map((g) => (g.id === id ? updated : g)),
    }));
  },

  deleteTestGroup: async (id) => {
    await api.deleteTestGroup(id);
    set((state) => ({ testGroups: state.testGroups.filter((g) => g.id !== id) }));
  },

  addMember: async (groupId, testCaseId) => {
    const updated = await api.addGroupMember(groupId, testCaseId);
    set((state) => ({
      testGroups: state.testGroups.map((g) => (g.id === groupId ? updated : g)),
    }));
  },

  removeMember: async (groupId, testCaseId) => {
    const updated = await api.removeGroupMember(groupId, testCaseId);
    set((state) => ({
      testGroups: state.testGroups.map((g) => (g.id === groupId ? updated : g)),
    }));
  },

  executeGroup: async (groupId) => {
    set({ executing: groupId, executionResult: null });
    try {
      const result = await api.executeTestGroup(groupId);
      set({ executing: null, executionResult: result });
      // Refresh groups to get updated test case statuses
      await get().loadTestGroups();
      return result;
    } catch (err) {
      set({ executing: null });
      throw err;
    }
  },

  clearExecution: () => set({ executionResult: null }),
  clear: () => set({ testGroups: [], error: null, loading: false, executionResult: null, executing: null }),
}));
