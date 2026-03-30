"use client";

import { DashboardHeader } from "./dashboard-header";
import { DashboardFilters } from "./dashboard-filters";
import { KPIGeneralCards } from "./kpi/general-cards";
import { ChartWrapper } from "./chart-wrapper";
import { StatusChart } from "./charts/status-chart";
import { ChannelChart } from "./charts/channel-chart";
import { AttendantChart } from "./charts/attendant-chart";
import { TagsChart } from "./charts/tags-chart";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ListLeadByRelatoryModal } from "./list-lead-by-relatory-modal";
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

import { WidgetList } from "./widget";
import { ChannelInsights } from "./channel-insights";
import { AppSelector, ALL_MODULES } from "./app-selector";
import type { AppModule } from "./app-selector";
import { CrossDataOverview } from "./cross-data-overview";
import { ForgeSection, SpacetimeSection, NasaPostSection, IntegrationsSection } from "./apps-sections";
import { useQueryAppsInsights } from "@/features/insights/hooks/use-dashboard";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { CustomizableChart } from "./customizable-chart";
import { InsightReport } from "./insight-report";

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
        <Skeleton className="h-75 w-full" />
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
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedModules, setSelectedModules] = useState<AppModule[]>(ALL_MODULES);

  const handleChartClick = (leadIds?: string[]) => {
    if (leadIds && leadIds.length > 0) {
      setSelectedLeadIds(leadIds);
      setIsModalOpen(true);
    }
  };

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
  const { data, isLoading, refresh } = useDashboardData({
    trackingId,
    organizationIds,
    tagIds,
    dateRange,
  });
  const { trackings } = useQueryListAllTrackings(organizationIds);
  const { data: organization } = authClient.useListOrganizations();

  const appsInput = {
    organizationIds: organizationIds.length ? organizationIds : undefined,
    startDate: dateRange.from?.toISOString(),
    endDate: dateRange.to?.toISOString(),
    trackingId: trackingId || undefined,
  };
  const { appsInsights } = useQueryAppsInsights(appsInput);

  // Meta Ads — only when integrations module is selected
  const { data: metaInsights } = useQuery(
    selectedModules.includes("integrations")
      ? orpc.channelInsights.meta.queryOptions({ input: { datePreset: "last_30d", level: "account" } })
      : { queryKey: ["meta-disabled"], queryFn: () => null, enabled: false },
  );

  const organizatins = organization || [];

  const trackingOptions = [
    { id: "ALL", name: "Todos os Trackings" },
    ...trackings.map((t) => ({ id: t.id, name: t.name })),
  ];
  const organizationOptions = [
    { id: "ALL", name: "Todos as Empresas" },
    ...organizatins.map((t) => ({ id: t.id, name: t.name })),
  ];

  const showTrackingFilters = selectedModules.includes("tracking");

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

          {/* App Selector */}
          <AppSelector selected={selectedModules} onChange={setSelectedModules} />

          {/* Filters — tracking/tags only when tracking module selected */}
          <DashboardFilters
            trackingId={showTrackingFilters ? (trackingId || "ALL") : undefined}
            organizationIds={organizationIds}
            tagIds={showTrackingFilters ? tagIds : []}
            dateRange={dateRange}
            trackingOptions={showTrackingFilters ? trackingOptions : []}
            organizationOptions={organizationOptions}
            onTrackingChange={(id) => setTrackingId(id === "ALL" ? "" : id)}
            onOrganizationToggle={toggleOrganizationId}
            onTagToggle={toggleTagId}
            onDateRangeChange={setDateRange}
            showTrackingFilter={showTrackingFilters}
            showTagsFilter={showTrackingFilters}
          />
          <TabsList>
            <TabsTrigger value="general">Visão Geral</TabsTrigger>
            {showTrackingFilters && <TabsTrigger value="tracking">📊 Tracking</TabsTrigger>}
            {selectedModules.includes("chat") && <TabsTrigger value="atendiment">💬 Atendimento</TabsTrigger>}
            {selectedModules.includes("integrations") && <TabsTrigger value="channels">📡 Canais</TabsTrigger>}
          </TabsList>
        </div>

        {/* ── VISÃO GERAL CRUZADA ──────────────────────────────────────────── */}
        <TabsContent value="general" className="flex-1 overflow-y-auto pt-6 space-y-8">
          {/* Customizable Chart — full width between tabs and CrossDataOverview */}
          <CustomizableChart
            selectedModules={selectedModules}
            tracking={data?.summary ? {
              totalLeads: data.summary.totalLeads,
              wonLeads: data.summary.wonLeads,
              activeLeads: data.summary.activeLeads,
            } : undefined}
            chat={appsInsights?.chat ? {
              totalConversations: appsInsights.chat.totalConversations,
              totalMessages: appsInsights.chat.totalMessages,
              attendedConversations: appsInsights.chat.attendedConversations,
              unattendedConversations: appsInsights.chat.unattendedConversations,
            } : undefined}
            forge={appsInsights?.forge ? {
              totalProposals: appsInsights.forge.totalProposals,
              rascunho: appsInsights.forge.rascunho,
              enviadas: appsInsights.forge.enviadas,
              visualizadas: appsInsights.forge.visualizadas,
              pagas: appsInsights.forge.pagas,
              expiradas: appsInsights.forge.expiradas,
              canceladas: appsInsights.forge.canceladas,
              revenueTotal: appsInsights.forge.revenueTotal,
              revenuePipeline: appsInsights.forge.revenuePipeline,
            } : undefined}
            spacetime={appsInsights?.spacetime ? {
              total: appsInsights.spacetime.total,
              pending: appsInsights.spacetime.pending,
              confirmed: appsInsights.spacetime.confirmed,
              done: appsInsights.spacetime.done,
              cancelled: appsInsights.spacetime.cancelled,
              noShow: appsInsights.spacetime.noShow,
            } : undefined}
            nasaPost={appsInsights?.nasaPost ? {
              total: appsInsights.nasaPost.total,
              draft: appsInsights.nasaPost.draft,
              published: appsInsights.nasaPost.published,
              scheduled: appsInsights.nasaPost.scheduled,
            } : undefined}
            metaAds={metaInsights?.connected && metaInsights.data ? {
              spend: metaInsights.data.spend,
              roas: metaInsights.data.roas,
              leads: metaInsights.data.leads,
              clicks: metaInsights.data.clicks,
              impressions: metaInsights.data.impressions,
            } : undefined}
          />

          {/* AI Report + PDF Download */}
          <InsightReport
            selectedModules={selectedModules}
            period={{ startDate: appsInput.startDate, endDate: appsInput.endDate }}
            orgName={organizatins[0]?.name ?? "Minha Empresa"}
            tracking={data?.summary ? {
              totalLeads: data.summary.totalLeads,
              wonLeads: data.summary.wonLeads,
              activeLeads: data.summary.activeLeads,
              conversionRate: data.summary.conversionRate,
            } : undefined}
            chat={appsInsights?.chat}
            forge={appsInsights?.forge}
            spacetime={appsInsights?.spacetime}
            nasaPost={appsInsights?.nasaPost}
            metaAds={metaInsights?.connected && metaInsights.data ? {
              spend: metaInsights.data.spend,
              roas: metaInsights.data.roas,
              leads: metaInsights.data.leads,
              clicks: metaInsights.data.clicks,
              impressions: metaInsights.data.impressions,
              ctr: metaInsights.data.ctr,
              cpl: metaInsights.data.cpl,
            } : undefined}
          />

          <CrossDataOverview
            selectedModules={selectedModules}
            tracking={data?.summary ? {
              totalLeads: data.summary.totalLeads,
              wonLeads: data.summary.wonLeads,
              conversionRate: data.summary.conversionRate,
              activeLeads: data.summary.activeLeads,
            } : undefined}
            chat={appsInsights?.chat ? {
              totalConversations: appsInsights.chat.totalConversations,
              totalMessages: appsInsights.chat.totalMessages,
              attendedConversations: appsInsights.chat.attendedConversations,
              attendanceRate: appsInsights.chat.attendanceRate,
            } : undefined}
            forge={appsInsights?.forge ? {
              totalProposals: appsInsights.forge.totalProposals,
              pagas: appsInsights.forge.pagas,
              revenueTotal: appsInsights.forge.revenueTotal,
              revenuePipeline: appsInsights.forge.revenuePipeline,
            } : undefined}
            spacetime={appsInsights?.spacetime ? {
              total: appsInsights.spacetime.total,
              done: appsInsights.spacetime.done,
              conversionRate: appsInsights.spacetime.conversionRate,
            } : undefined}
            nasaPost={appsInsights?.nasaPost ? {
              total: appsInsights.nasaPost.total,
              published: appsInsights.nasaPost.published,
            } : undefined}
            metaAds={metaInsights?.connected && metaInsights.data ? {
              spend: metaInsights.data.spend,
              roas: metaInsights.data.roas,
              leads: metaInsights.data.leads,
              cpl: metaInsights.data.cpl,
            } : undefined}
          />

          {/* App-specific sections */}
          <div className="space-y-8">
            {selectedModules.includes("forge") && appsInsights?.forge && (
              <ForgeSection data={appsInsights.forge} />
            )}
            {selectedModules.includes("spacetime") && appsInsights?.spacetime && (
              <SpacetimeSection data={appsInsights.spacetime} />
            )}
            {selectedModules.includes("nasa-post") && appsInsights?.nasaPost && (
              <NasaPostSection data={appsInsights.nasaPost} />
            )}
            {selectedModules.includes("integrations") && (
              <IntegrationsSection metaAds={metaInsights ?? undefined} />
            )}
          </div>

          <WidgetList organizationIds={organizationIds} />
        </TabsContent>

        {/* ── TRACKING ─────────────────────────────────────────────────────── */}
        {showTrackingFilters && (
          <TabsContent value="tracking" className="flex-1 overflow-y-auto pt-6 space-y-6">
            {settings.visibleSections.summary && (
              <section>
                <h2 className="mb-4 text-lg font-semibold">Leads & Pipeline</h2>
                {isLoading ? <KPISkeleton /> : <KPIGeneralCards summary={data.summary} />}
              </section>
            )}
            <div className={cn("grid gap-6 lg:grid-cols-2")}>
              {settings.visibleSections.byStatus && (isLoading ? <ChartSkeleton /> : (
                <ChartWrapper title="Leads por Status" description="Distribuição por status atual"
                  chartType={settings.chartTypes.byStatus}
                  onChartTypeChange={(type) => setChartType("byStatus", type)}
                  isVisible={settings.visibleSections.byStatus}
                  onVisibilityToggle={() => toggleSection("byStatus")}>
                  <StatusChart data={data.byStatus} chartType={settings.chartTypes.byStatus} onClick={handleChartClick} />
                </ChartWrapper>
              ))}
              {settings.visibleSections.byChannel && (isLoading ? <ChartSkeleton /> : (
                <ChartWrapper title="Leads por Canal" description="Origem dos leads por canal"
                  chartType={settings.chartTypes.byChannel}
                  onChartTypeChange={(type) => setChartType("byChannel", type)}
                  isVisible={settings.visibleSections.byChannel}
                  onVisibilityToggle={() => toggleSection("byChannel")}>
                  <ChannelChart data={data.byChannel} chartType={settings.chartTypes.byChannel} onClick={handleChartClick} />
                </ChartWrapper>
              ))}
              {settings.visibleSections.byAttendant && (isLoading ? <ChartSkeleton /> : (
                <ChartWrapper title="Performance por Atendente" description="Total de leads e conversões por responsável"
                  chartType={settings.chartTypes.byAttendant}
                  onChartTypeChange={(type) => setChartType("byAttendant", type)}
                  isVisible={settings.visibleSections.byAttendant}
                  onVisibilityToggle={() => toggleSection("byAttendant")}>
                  <AttendantChart data={data.byAttendant} chartType={settings.chartTypes.byAttendant} onClick={handleChartClick} />
                </ChartWrapper>
              ))}
              {settings.visibleSections.topTags && (isLoading ? <ChartSkeleton /> : (
                <ChartWrapper title="Top Tags" description="Tags mais utilizadas nos leads"
                  chartType={settings.chartTypes.topTags}
                  onChartTypeChange={(type) => setChartType("topTags", type)}
                  isVisible={settings.visibleSections.topTags}
                  onVisibilityToggle={() => toggleSection("topTags")}>
                  <TagsChart data={data.topTags} chartType={settings.chartTypes.topTags} onClick={handleChartClick} />
                </ChartWrapper>
              ))}
            </div>
          </TabsContent>
        )}

        {/* ── ATENDIMENTO ───────────────────────────────────────────────────── */}
        {selectedModules.includes("chat") && (
          <TabsContent value="atendiment" className="flex-1 overflow-y-auto pt-6 space-y-6">
            <h2 className="mb-4 text-lg font-semibold">Atendimento</h2>
            <KPIAtendimentCards summary={data.summary} />
          </TabsContent>
        )}

        {/* ── CANAIS ────────────────────────────────────────────────────────── */}
        {selectedModules.includes("integrations") && (
          <TabsContent value="channels" className="flex-1 overflow-y-auto pt-6">
            <ChannelInsights />
          </TabsContent>
        )}
      </div>

      <ListLeadByRelatoryModal
        isOpen={isModalOpen}
        onOpenChange={setIsModalOpen}
        leadIds={selectedLeadIds}
      />
    </Tabs>
  );
}
