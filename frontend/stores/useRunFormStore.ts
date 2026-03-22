import { create } from 'zustand';
import { api } from '../lib/api';

interface RunFormStore {
  url: string;
  personaId: string;
  maxSteps: number;
  setUrl: (url: string) => void;
  setPersonaId: (id: string) => void;
  setMaxSteps: (steps: number) => void;
  submit: () => Promise<string>;
  reset: () => void;
}

export const useRunFormStore = create<RunFormStore>((set, get) => ({
  url: '',
  personaId: 'new_user',
  maxSteps: 30,

  setUrl: (url: string) => set({ url }),
  setPersonaId: (id: string) => set({ personaId: id }),
  setMaxSteps: (steps: number) => set({ maxSteps: steps }),

  submit: async () => {
    const { url, personaId, maxSteps } = get();
    const response = await api.createRun({
      url,
      personaId,
      options: { maxSteps },
    });
    return response.runId;
  },

  reset: () => set({ url: '', personaId: 'new_user', maxSteps: 30 }),
}));
