"use client";

import { useTourStore } from "./store";

export type { TourStep } from "./types";

// O estado mora na store Zustand (spec 0046); o provider ficou só para não
// quebrar quem ainda o monta.
export function TourProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function useTour() {
  const isActive = useTourStore((state) => state.isActive);
  const stepIndex = useTourStore((state) => state.stepIndex);
  const steps = useTourStore((state) => state.steps);
  const startTour = useTourStore((state) => state.startTour);
  const nextStep = useTourStore((state) => state.nextStep);
  const prevStep = useTourStore((state) => state.prevStep);
  const endTour = useTourStore((state) => state.endTour);
  return { isActive, stepIndex, steps, startTour, nextStep, prevStep, endTour };
}
