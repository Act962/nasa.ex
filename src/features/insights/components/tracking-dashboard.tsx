"use client";

import { DashboardHeader } from "./dashboard-header";
import { DashboardFilters } from "./dashboard-filters";
import { KPIGeneralCards } from "./kpi/general-cards";
import { ChartWrapper } from "./chart-wrapper";
import { StatusChart } from "./charts/status-chart";
import { ChannelChart } from "./charts/channel-chart";
import { AttendantChart } from "./charts/attendant-chart";
import { TagsChart } from "./charts/tags-chart";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useDashboardStore } from "@/features/insights/hooks/use-dashboard-store";
import {
  useDashboardData,
  useQueryListAllTrackings,
} from "@/features/insights/hooks/use-dashboard";
import type { DashboardReport } from "@/features/insights/types";
import { authClient } from "@/lib/auth-client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KPIAtendimentCards } from "./kpi/atendiment-cards";
import { cn } from "@/lib/utils";

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
    organizationIds,
    tagIds,
    dateRange,
    settings,
    setTrackingId,
    toggleOrganizationId,
    setDateRange,
    toggleTagId,
    toggleSection,
    setChartType,
    resetSettings,
  } = useDashboardStore();

  // Usando Tanstack Query para fetch dos dados
  const { data, isLoading, isValidating, refresh } = useDashboardData({
    trackingId,
    organizationIds,
    tagIds,
    dateRange,
  });
  const { trackings } = useQueryListAllTrackings(organizationIds);
  const { data: organization } = authClient.useListOrganizations();

  const organizatins = organization || [];

  const trackingOptions = [
    { id: "ALL", name: "Todos os Trackings" },
    ...trackings.map((t) => ({ id: t.id, name: t.name })),
  ];
  const organizationOptions = [
    { id: "ALL", name: "Todos as Empresas" },
    ...organizatins.map((t) => ({ id: t.id, name: t.name })),
  ];

  return (
    <Tabs defaultValue="general">
      <div className="flex flex-col h-full w-full">
        <div className="sm:sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b py-4 space-y-4">
          <DashboardHeader
            settings={settings}
            onToggleSection={toggleSection}
            onChartTypeChange={setChartType}
            onReset={resetSettings}
            onRefresh={refresh}
            isLoading={isLoading}
          />

          <DashboardFilters
            trackingId={trackingId || "ALL"}
            organizationIds={organizationIds}
            tagIds={tagIds}
            dateRange={dateRange}
            trackingOptions={trackingOptions}
            organizationOptions={organizationOptions}
            onTrackingChange={(id) => setTrackingId(id === "ALL" ? "" : id)}
            onOrganizationToggle={toggleOrganizationId}
            onTagToggle={toggleTagId}
            onDateRangeChange={setDateRange}
          />
          <TabsList>
            <TabsTrigger value="general">Geral</TabsTrigger>
            <TabsTrigger value="atendiment">Atendimento</TabsTrigger>
          </TabsList>
        </div>

        {/* KPI Cards */}
        <TabsContent
          value="general"
          className="flex-1 overflow-y-auto pt-6 space-y-6"
        >
          {settings.visibleSections.summary && (
            <section>
              <h2 className="mb-4 text-lg font-semibold">Resumo</h2>
              {isLoading ? (
                <KPISkeleton />
              ) : (
                <KPIGeneralCards summary={data.summary} />
              )}
            </section>
          )}

          {/* Charts Grid */}
          <div className={cn("grid gap-6 lg:grid-cols-2")}>
            {settings.visibleSections.byStatus &&
              (isLoading ? (
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
              ))}
            {/* Channel Chart */}
            {settings.visibleSections.byChannel &&
              (isLoading ? (
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
              ))}
            {/* Attendant Chart */}
            {settings.visibleSections.byAttendant &&
              (isLoading ? (
                <ChartSkeleton />
              ) : (
                <ChartWrapper
                  title="Performance por Atendente"
                  description="Total de leads e conversões por responsável"
                  chartType={settings.chartTypes.byAttendant}
                  onChartTypeChange={(type) =>
                    setChartType("byAttendant", type)
                  }
                  isVisible={settings.visibleSections.byAttendant}
                  onVisibilityToggle={() => toggleSection("byAttendant")}
                >
                  <AttendantChart
                    data={data.byAttendant}
                    chartType={settings.chartTypes.byAttendant}
                  />
                </ChartWrapper>
              ))}
            {/* Tags Chart */}
            {settings.visibleSections.topTags &&
              (isLoading ? (
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
              ))}
          </div>
        </TabsContent>
        <TabsContent
          value="atendiment"
          className="flex-1 overflow-y-auto pt-6 space-y-6"
        >
          <h2 className="mb-4 text-lg font-semibold">Atendimento</h2>
          <KPIAtendimentCards summary={data.summary} />
        </TabsContent>
      </div>
    </Tabs>
  );
}
