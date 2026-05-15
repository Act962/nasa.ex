"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Estado global do AstroOrb — o "pet" flutuante do Astro.
 *
 * Fases visuais:
 *   - idle:       parado, semitransparente (wake word escutando ao fundo se opt-in)
 *   - listening:  círculo pulsando azul — capturando utterance do user
 *   - thinking:   gira violeta — Astro processando
 *   - speaking:   waveform verde — TTS narrando
 *
 * Wake word é OPT-IN explícito. Persistido em localStorage.
 *
 * Captured utterance: quando o wake word dispara, o orb captura o próximo
 * trecho de fala e armazena em `pendingUtterance` pra ser consumido pelo
 * NASA Command Center (auto-submit ao montar).
 */

export type OrbPhase = "idle" | "listening" | "thinking" | "speaking";

interface AstroOrbStore {
  /** True quando o orb está visível na tela. */
  visible: boolean;
  /** Fase visual atual. */
  phase: OrbPhase;
  /** Opt-in: escutar continuamente pela palavra "ASTRO". Persistido. */
  wakeWordEnabled: boolean;
  /** Mensagem efêmera mostrada perto do orb (ex: "Te ouvindo, Wey…"). */
  hint: string | null;
  /** Utterance capturado após wake word, ainda não submetido. */
  pendingUtterance: string | null;

  setPhase: (phase: OrbPhase) => void;
  setWakeWordEnabled: (v: boolean) => void;
  setVisible: (v: boolean) => void;
  setHint: (msg: string | null) => void;
  setPendingUtterance: (text: string | null) => void;
  /** Atalho: marca phase + hint juntos (mais comum no fluxo). */
  setState: (s: { phase?: OrbPhase; hint?: string | null }) => void;
}

export const useAstroOrbStore = create<AstroOrbStore>()(
  persist(
    (set) => ({
      visible: true,
      phase: "idle",
      wakeWordEnabled: false, // OPT-IN — user precisa ativar
      hint: null,
      pendingUtterance: null,

      setPhase: (phase) => set({ phase }),
      setWakeWordEnabled: (wakeWordEnabled) => set({ wakeWordEnabled }),
      setVisible: (visible) => set({ visible }),
      setHint: (hint) => set({ hint }),
      setPendingUtterance: (pendingUtterance) => set({ pendingUtterance }),
      setState: ({ phase, hint }) =>
        set((s) => ({
          phase: phase ?? s.phase,
          hint: hint === undefined ? s.hint : hint,
        })),
    }),
    {
      name: "astro-orb",
      partialize: (state) => ({
        wakeWordEnabled: state.wakeWordEnabled,
        visible: state.visible,
      }),
    },
  ),
);
