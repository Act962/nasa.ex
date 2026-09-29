"use client";

import { useCallback } from "react";
import { useTourStore } from "@/features/tour/store";
import { useAstroWidgetStore } from "@/features/astro/voice/use-astro-widget-store";
import { findGuide, toTourSteps } from "../lib/registry";

export function useStartGuide() {
  const startTour = useTourStore((state) => state.startTour);
  const closeAstroWidget = useAstroWidgetStore((state) => state.close);

  return useCallback(
    (guideKey: string): boolean => {
      const guide = findGuide(guideKey);
      if (!guide) return false;
      // O painel do Astro cobriria o que o guia destaca.
      closeAstroWidget();
      startTour(toTourSteps(guide), { finish: guide.finish, guideKey: guide.key });
      return true;
    },
    [closeAstroWidget, startTour],
  );
}
