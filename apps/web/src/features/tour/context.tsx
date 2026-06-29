"use client";

import { createContext, useCallback, useContext, useState } from "react";

export interface TourStep {
  id:       string;
  selector: string;           // CSS selector → target element
  title:    string;
  message:  string;
  position: "top" | "bottom" | "left" | "right";
  padding?: number;           // extra space around the spotlight (px)
  pulse?:   boolean;          // add pulsing ring to the target
}

interface TourCtx {
  isActive:  boolean;
  stepIndex: number;
  steps:     TourStep[];
  startTour: (steps: TourStep[]) => void;
  nextStep:  () => void;
  prevStep:  () => void;
  endTour:   () => void;
}

const TourContext = createContext<TourCtx>({
  isActive: false, stepIndex: 0, steps: [],
  startTour: () => {}, nextStep: () => {}, prevStep: () => {}, endTour: () => {},
});

export const useTour = () => useContext(TourContext);

export function TourProvider({ children }: { children: React.ReactNode }) {
  const [steps, setSteps]         = useState<TourStep[]>([]);
  const [stepIndex, setStepIndex] = useState(0);
  const [isActive, setIsActive]   = useState(false);

  const startTour = useCallback((s: TourStep[]) => {
    setSteps(s);
    setStepIndex(0);
    setIsActive(true);
  }, []);

  const nextStep = useCallback(() => {
    setStepIndex((i) => {
      if (i + 1 >= steps.length) { setIsActive(false); return 0; }
      return i + 1;
    });
  }, [steps.length]);

  const prevStep = useCallback(() => {
    setStepIndex((i) => Math.max(0, i - 1));
  }, []);

  const endTour = useCallback(() => {
    setIsActive(false);
    setStepIndex(0);
  }, []);

  return (
    <TourContext.Provider value={{ isActive, stepIndex, steps, startTour, nextStep, prevStep, endTour }}>
      {children}
    </TourContext.Provider>
  );
}
