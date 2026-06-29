"use client";

import { create } from "zustand";
import type { CriticalAlertPayload } from "../components/alert-critical-popup";

interface AlertStore {
  activeCritical: CriticalAlertPayload | null;
  queue: CriticalAlertPayload[];

  pushCritical: (payload: CriticalAlertPayload) => void;
  acknowledge: () => void;
  clear: () => void;
}

/**
 * Fila de alertas críticos.
 *
 * - `pushCritical` adiciona ao queue; se nenhum estiver ativo, promove imediatamente.
 * - `acknowledge` confirma o ativo e promove o próximo (se houver).
 * - Evita duplicatas pelo `id` (alerta crítico chegando 2x em multi-tab).
 */
export const useAlertStore = create<AlertStore>((set, get) => ({
  activeCritical: null,
  queue: [],

  pushCritical: (payload) => {
    const state = get();
    const exists =
      state.activeCritical?.id === payload.id ||
      state.queue.some((q) => q.id === payload.id);
    if (exists) return;

    if (!state.activeCritical) {
      set({ activeCritical: payload });
    } else {
      set({ queue: [...state.queue, payload] });
    }
  },

  acknowledge: () => {
    const state = get();
    const next = state.queue[0] ?? null;
    set({
      activeCritical: next,
      queue: state.queue.slice(1),
    });
  },

  clear: () => set({ activeCritical: null, queue: [] }),
}));
