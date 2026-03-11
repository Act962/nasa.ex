"use client";

import { LayoutDashboard, Link2Icon, RefreshCwIcon } from "lucide-react";
import { SettingsPanel } from "./settings-panel";
import type { DashboardSettings, ChartType } from "@/features/insights/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SharingInsights } from "./sharing-insight-modal";
import { useDashboardStore } from "../hooks/use-dashboard-store";
import { authClient } from "@/lib/auth-client";

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
  onRefresh: () => void;
  isLoading: boolean;
}

export function DashboardHeader({
  settings,
  onToggleSection,
  onChartTypeChange,
  onReset,
  onRefresh,
  isLoading,
}: DashboardHeaderProps) {
  const store = useDashboardStore();
  const session = authClient.useSession();

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
      <div className="space-x-2">
        <SharingInsights
          filters={{
            trackingId: store.trackingId,
            organizationIds:
              store.organizationIds.length === 0
                ? [session.data?.session.activeOrganizationId]
                : store.organizationIds,
            tagIds: store.tagIds,
            dateRange: store.dateRange,
          }}
          settings={settings}
        >
          <Button
            variant="outline"
            size="icon"
            disabled={isLoading}
            className="self-end sm:self-auto"
          >
            <Link2Icon className="size-4" />
          </Button>
        </SharingInsights>
        <Button
          variant="outline"
          size="icon"
          onClick={onRefresh}
          disabled={isLoading}
          className="self-end sm:self-auto"
        >
          <RefreshCwIcon
            className={cn("h-4 w-4", isLoading && "animate-spin")}
          />
        </Button>
        <SettingsPanel
          settings={settings}
          onToggleSection={onToggleSection}
          onChartTypeChange={onChartTypeChange}
          onReset={onReset}
        />
      </div>
    </div>
  );
}
