"use client";

import { useEffect } from "react";
import type { AppModule } from "@/features/insights/types";
import { useDashboardStore } from "@/features/insights/hooks/use-dashboard-store";
import { TrackingDashboard } from "./tracking-dashboard";

/** Abre o Insights com só o App da URL marcado; depois o usuário pode marcar outros normalmente. */
export function AppInsightsEntry({ appModule }: { appModule: AppModule }) {
  const { setSelectedModules } = useDashboardStore();

  useEffect(() => {
    setSelectedModules([appModule]);
  }, [appModule, setSelectedModules]);

  return <TrackingDashboard />;
}
