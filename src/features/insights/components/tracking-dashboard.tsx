"use client";

import { DashboardHeader } from "./dashboard-header";
import { DashboardFilters } from "./dashboard-filters";
import { KPICards } from "./kpi-cards";
import { ChartWrapper } from "./chart-wrapper";
import { StatusChart } from "./status-chart";
import { ChannelChart } from "./channel-chart";
import { AttendantChart } from "./attendant-chart";
import { TagsChart } from "./tags-chart";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useDashboardStore } from "@/features/insights/hooks/use-dashboard-store";
import {
  useDashboardData,
  useQueryListTrackings,
} from "@/features/insights/hooks/use-dashboard";
import type { DashboardReport } from "@/features/insights/types";

interface TrackingDashboardProps {
  initialData?: DashboardReport;
}

function ChartSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-3 w-48" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-[300px] w-full" />
      </CardContent>
    </Card>
  );
}

function KPISkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-8 rounded-lg" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-7 w-20" />
            <Skeleton className="mt-2 h-3 w-32" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function TrackingDashboard({
  initialData: _initialData,
}: TrackingDashboardProps) {
  const {
    trackingId,
    tagIds,
    dateRange,
    settings,
    setTrackingId,
    setDateRange,
    toggleTagId,
    toggleSection,
    setChartType,
    resetSettings,
  } = useDashboardStore();

  // Usando Tanstack Query para fetch dos dados
  const { data, isLoading, isValidating, refresh } = useDashboardData({
    trackingId,
    tagIds,
    dateRange,
  });

  const { trackings } = useQueryListTrackings();

  const trackingOptions = [
    { id: "ALL", name: "Todos os Trackings" },
    ...trackings.map((t) => ({ id: t.id, name: t.name })),
  ];

  return (
    <div className="space-y-6">
      <DashboardHeader
        settings={settings}
        onToggleSection={toggleSection}
        onChartTypeChange={setChartType}
        onReset={resetSettings}
      />

      <DashboardFilters
        trackingId={trackingId || "ALL"}
        tagIds={tagIds}
        dateRange={dateRange}
        trackingOptions={trackingOptions}
        onTrackingChange={(id) => setTrackingId(id === "ALL" ? "" : id)}
        onTagToggle={toggleTagId}
        onDateRangeChange={setDateRange}
        onRefresh={refresh}
        isLoading={isLoading || isValidating}
      />

      {/* KPI Cards */}
      {settings.visibleSections.summary && (
        <section>
          <h2 className="mb-4 text-lg font-semibold">Resumo</h2>
          {isLoading ? <KPISkeleton /> : <KPICards summary={data.summary} />}
        </section>
      )}

      {/* Charts Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Status Chart */}
        {isLoading ? (
          <ChartSkeleton />
        ) : (
          <ChartWrapper
            title="Leads por Status"
            description="Distribuição de leads por status atual"
            chartType={settings.chartTypes.byStatus}
            onChartTypeChange={(type) => setChartType("byStatus", type)}
            isVisible={settings.visibleSections.byStatus}
            onVisibilityToggle={() => toggleSection("byStatus")}
          >
            <StatusChart
              data={data.byStatus}
              chartType={settings.chartTypes.byStatus}
            />
          </ChartWrapper>
        )}

        {/* Channel Chart */}
        {isLoading ? (
          <ChartSkeleton />
        ) : (
          <ChartWrapper
            title="Leads por Canal"
            description="Origem dos leads por canal de aquisição"
            chartType={settings.chartTypes.byChannel}
            onChartTypeChange={(type) => setChartType("byChannel", type)}
            isVisible={settings.visibleSections.byChannel}
            onVisibilityToggle={() => toggleSection("byChannel")}
          >
            <ChannelChart
              data={data.byChannel}
              chartType={settings.chartTypes.byChannel}
            />
          </ChartWrapper>
        )}

        {/* Attendant Chart */}
        {isLoading ? (
          <ChartSkeleton />
        ) : (
          <ChartWrapper
            title="Performance por Atendente"
            description="Total de leads e conversões por responsável"
            chartType={settings.chartTypes.byAttendant}
            onChartTypeChange={(type) => setChartType("byAttendant", type)}
            isVisible={settings.visibleSections.byAttendant}
            onVisibilityToggle={() => toggleSection("byAttendant")}
          >
            <AttendantChart
              data={data.byAttendant}
              chartType={settings.chartTypes.byAttendant}
            />
          </ChartWrapper>
        )}

        {/* Tags Chart */}
        {isLoading ? (
          <ChartSkeleton />
        ) : (
          <ChartWrapper
            title="Top Tags"
            description="Tags mais utilizadas nos leads"
            chartType={settings.chartTypes.topTags}
            onChartTypeChange={(type) => setChartType("topTags", type)}
            isVisible={settings.visibleSections.topTags}
            onVisibilityToggle={() => toggleSection("topTags")}
          >
            <TagsChart
              data={data.topTags}
              chartType={settings.chartTypes.topTags}
            />
          </ChartWrapper>
        )}
      </div>
    </div>
  );
}
