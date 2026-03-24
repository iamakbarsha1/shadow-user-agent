import { create } from 'zustand';
import { api } from '../lib/api';

interface RunFormStore {
  url: string;
  personaId: string;
  maxSteps: number;
  runType: 'browser' | 'api';
  apiSpec: string;
  setUrl: (url: string) => void;
  setPersonaId: (id: string) => void;
  setMaxSteps: (steps: number) => void;
  setRunType: (t: 'browser' | 'api') => void;
  setApiSpec: (spec: string) => void;
  submit: () => Promise<string>;
  reset: () => void;
}

export const useRunFormStore = create<RunFormStore>((set, get) => ({
  url: '',
  personaId: 'new_user',
  maxSteps: 30,
  runType: 'browser',
  apiSpec: '',

  setUrl: (url: string) => set({ url }),
  setPersonaId: (id: string) => set({ personaId: id }),
  setMaxSteps: (steps: number) => set({ maxSteps: steps }),
  setRunType: (runType) => set({ runType }),
  setApiSpec: (apiSpec) => set({ apiSpec }),

  submit: async () => {
    const { url, personaId, maxSteps, runType, apiSpec } = get();
    const response = await api.createRun({
      url,
      personaId,
      runType,
      ...(runType === 'api' ? { apiSpec } : {}),
      options: { maxSteps },
    });
    return response.runId;
  },

  reset: () => set({ url: '', personaId: 'new_user', maxSteps: 30, runType: 'browser', apiSpec: '' }),
}));
