"use client";

import { LayoutDashboard } from "lucide-react";
import { SettingsPanel } from "./settings-panel";
import type { DashboardSettings, ChartType } from "@/features/insights/types";

interface DashboardHeaderProps {
  settings: DashboardSettings;
  onToggleSection: (
    section: keyof DashboardSettings["visibleSections"],
  ) => void;
  onChartTypeChange: (
    chart: keyof DashboardSettings["chartTypes"],
    type: ChartType,
  ) => void;
  onReset: () => void;
}

export function DashboardHeader({
  settings,
  onToggleSection,
  onChartTypeChange,
  onReset,
}: DashboardHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-foreground/10 p-2">
          <LayoutDashboard className="size-4 text-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-medium tracking-tight">
            Dashboard de Tracking
          </h1>
          <p className="text-sm text-muted-foreground">
            Acompanhe suas métricas de leads e conversões em tempo real
          </p>
        </div>
      </div>
      <SettingsPanel
        settings={settings}
        onToggleSection={onToggleSection}
        onChartTypeChange={onChartTypeChange}
        onReset={onReset}
      />
    </div>
  );
}
