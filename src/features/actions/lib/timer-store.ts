import { create } from "zustand";

interface TimerState {
  activeActionId: string | null;
  startedAt: Date | null;
  accumulatedSeconds: number;
  currentSeconds: number;

  actions: {
    start: (actionId: string, startedAt: Date, accumulatedSeconds: number) => void;
    stop: () => void;
    tick: () => void;
    sync: (actionId: string | null, startedAt: Date | null, accumulatedSeconds: number) => void;
  };
}

export const useTimerStore = create<TimerState>((set, get) => ({
  activeActionId: null,
  startedAt: null,
  accumulatedSeconds: 0,
  currentSeconds: 0,

  actions: {
    start: (actionId, startedAt, accumulatedSeconds) => {
      set({
        activeActionId: actionId,
        startedAt,
        accumulatedSeconds,
        currentSeconds: accumulatedSeconds,
      });
    },

    stop: () => {
      set({
        activeActionId: null,
        startedAt: null,
        accumulatedSeconds: 0,
        currentSeconds: 0,
      });
    },

    sync: (actionId, startedAt, accumulatedSeconds) => {
      // Sincroniza o estado local com o que vem do servidor
      // Só atualiza se houver mudança para evitar re-renders desnecessários
      const state = get();
      if (
        state.activeActionId !== actionId ||
        state.accumulatedSeconds !== accumulatedSeconds ||
        (startedAt && state.startedAt?.getTime() !== new Date(startedAt).getTime())
      ) {
        set({
          activeActionId: actionId,
          startedAt: startedAt ? new Date(startedAt) : null,
          accumulatedSeconds,
          currentSeconds: accumulatedSeconds,
        });
      }
    },

    tick: () => {
      const { startedAt, accumulatedSeconds, activeActionId } = get();
      if (!activeActionId || !startedAt) return;

      const now = new Date().getTime();
      const start = new Date(startedAt).getTime();
      const sessionSeconds = Math.floor((now - start) / 1000);
      
      const newTotal = accumulatedSeconds + (sessionSeconds > 0 ? sessionSeconds : 0);
      
      // Apenas atualiza se o valor mudou (segundo a segundo)
      if (get().currentSeconds !== newTotal) {
        set({ currentSeconds: newTotal });
      }
    },
  },
}));

// Ticker Global (Iniciado apenas no lado do cliente)
if (typeof window !== "undefined") {
  setInterval(() => {
    useTimerStore.getState().actions.tick();
  }, 1000);
}
