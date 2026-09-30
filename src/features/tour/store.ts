"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { TourFinish, TourResult, TourStep } from "./types";

// Em sessionStorage para o guia sobreviver à troca de rota e ao reload (spec 0046, RNF-2).

interface StartTourOptions {
  finish?: TourFinish;
  guideKey?: string;
}

interface TourStore {
  isActive: boolean;
  stepIndex: number;
  steps: TourStep[];
  guideKey: string | null;
  finish: TourFinish | null;
  /** Guia chegou ao fim e mostra o cartão final. */
  isFinished: boolean;
  result: TourResult | null;

  startTour: (steps: TourStep[], options?: StartTourOptions) => void;
  /** `fromIndex` torna o avanço idempotente: só avança se ainda estiver nele (RF-8). */
  nextStep: (fromIndex?: number) => void;
  prevStep: () => void;
  endTour: () => void;
  completeWithResult: (result: TourResult) => void;
}

const IDLE_STATE = {
  isActive: false,
  stepIndex: 0,
  steps: [] as TourStep[],
  guideKey: null,
  finish: null,
  isFinished: false,
  result: null,
};

export const useTourStore = create<TourStore>()(
  persist(
    (set, get) => ({
      ...IDLE_STATE,

      startTour: (steps, options) =>
        set({
          ...IDLE_STATE,
          isActive: steps.length > 0,
          steps,
          guideKey: options?.guideKey ?? null,
          finish: options?.finish ?? null,
        }),

      nextStep: (fromIndex) => {
        const { stepIndex, steps, finish } = get();
        if (fromIndex !== undefined && fromIndex !== stepIndex) return;
        if (stepIndex + 1 < steps.length) {
          set({ stepIndex: stepIndex + 1 });
          return;
        }
        if (finish) set({ isFinished: true });
        else set(IDLE_STATE);
      },

      prevStep: () => set((state) => ({ stepIndex: Math.max(0, state.stepIndex - 1) })),

      endTour: () => set(IDLE_STATE),

      completeWithResult: (result) => {
        const { isActive, isFinished, steps, finish } = get();
        const waitsForThisResult = steps.some(
          (step) => step.advanceOn === "result" && step.resultKind === result.kind,
        );
        if (!isActive || isFinished || !waitsForThisResult) return;
        if (finish) set({ isFinished: true, result });
        else set(IDLE_STATE);
      },
    }),
    {
      name: "nasa-tour",
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);

const TOUR_RESULT_EVENT = "nasa-tour:result";

/** A tela avisa que a ação do guia terminou — ex.: o lead foi salvo. */
export function emitTourResult(result: TourResult) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<TourResult>(TOUR_RESULT_EVENT, { detail: result }));
}

export function subscribeTourResult(onResult: (result: TourResult) => void): () => void {
  const listener = (event: Event) => onResult((event as CustomEvent<TourResult>).detail);
  window.addEventListener(TOUR_RESULT_EVENT, listener);
  return () => window.removeEventListener(TOUR_RESULT_EVENT, listener);
}
