"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Estado leve do composer: histórico de últimos comandos enviados.
 *
 * Usado pelo CmdkPalette pra mostrar "Atalhos recentes" — 1 click envia
 * de novo. Persistido em localStorage pra sobreviver reload.
 *
 * Cap em 6 entradas. Evita acumular ruído ad infinitum.
 */

export interface RecentCommand {
  id: string;
  /** Prompt natural montado pelo composer (o que vai pro Astro). */
  prompt: string;
  /** Label curta pra UI ("Criar lead", "Buscar proposta", etc). */
  label: string;
  /** Timestamp pra ordenar. */
  at: number;
}

interface ComposerStore {
  recent: RecentCommand[];
  pushRecent: (cmd: Omit<RecentCommand, "id" | "at">) => void;
  clearRecent: () => void;
}

const CAP = 6;

export const useComposerStore = create<ComposerStore>()(
  persist(
    (set) => ({
      recent: [],
      pushRecent: (cmd) =>
        set((s) => {
          const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          const next: RecentCommand = { ...cmd, id, at: Date.now() };
          // Remove duplicatas (mesmo prompt) antes de inserir
          const dedup = s.recent.filter((r) => r.prompt !== cmd.prompt);
          return { recent: [next, ...dedup].slice(0, CAP) };
        }),
      clearRecent: () => set({ recent: [] }),
    }),
    {
      name: "astro-composer",
      partialize: (state) => ({ recent: state.recent }),
    },
  ),
);
