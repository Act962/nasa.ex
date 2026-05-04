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
import { AppSelector } from "./app-selector";
import { CrossDataOverview } from "./cross-data-overview";
import { CrossInsightsPanel } from "./cross-insights-panel";
import { OrgLayoutProvider } from "@/features/insights/context/org-layout-provider";
import { AppMetricCard } from "./app-metric-card";
import { AddInsightButton } from "./add-insight-button";
import { LayoutEditToolbar } from "./layout-edit-toolbar";
import { WidgetTag } from "./widget";
import {
  ForgeSection,
  SpacetimeSection,
  NasaPlannerSection,
  IntegrationsSection,
  WorkspaceSection,
  FormsSection,
  NBoxSection,
  PaymentSection,
  LinnkerSection,
  SpacePointsSection,
  StarsSection,
  SpaceStationSection,
  NasaRouteSection,
} from "./apps-sections";
import { SortableDashboardSections } from "./sortable-dashboard-sections";
import { useQueryAppsInsights } from "@/features/insights/hooks/use-dashboard";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { CustomizableChart } from "./customizable-chart";
import { InsightReport } from "./insight-report";
import { HeaderTracking } from "@/features/leads/components/header-tracking";
import { InsightsTabsNav } from "./insights-tabs-nav";

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
    selectedModules,
    setTrackingId,
    toggleOrganizationId,
    setDateRange,
    toggleTagId,
    toggleSection,
    setChartType,
    resetSettings,
    setSelectedModules,
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
    tagIds: tagIds.length ? tagIds : undefined,
  };
  const { appsInsights } = useQueryAppsInsights(appsInput);

  // Meta Ads — only when integrations module is selected.
  // dateRange global tem prioridade sobre o preset; quando vazio, fallback last_30d.
  const metaInput = {
    level: "account" as const,
    ...(dateRange.from && dateRange.to
      ? {
          startDate: dateRange.from.toISOString(),
          endDate: dateRange.to.toISOString(),
        }
      : { datePreset: "last_30d" as const }),
  };
  const { data: metaInsights } = useQuery(
    selectedModules.includes("integrations")
      ? orpc.channelInsights.meta.queryOptions({ input: metaInput })
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
    <OrgLayoutProvider>
    <Tabs defaultValue="general">
      <div className="flex flex-col h-full w-full">
        <HeaderTracking title="Insights" />
        <InsightsTabsNav />
        <div className="sm:sticky top-10 z-10 bg-background/95 backdrop-blur-sm border-b py-4 space-y-4 px-2 sm:px-6">
          <DashboardHeader
            settings={settings}
            onToggleSection={toggleSection}
            onChartTypeChange={setChartType}
            onReset={resetSettings}
            onRefresh={refresh}
            isLoading={isLoading}
            filters={{
              trackingId,
              organizationIds,
              tagIds,
              dateRange,
            }}
            modules={selectedModules}
            snapshotData={{
              period: {
                startDate: appsInput.startDate,
                endDate: appsInput.endDate,
              },
              tracking: data?.summary
                ? {
                    totalLeads: data.summary.totalLeads,
                    wonLeads: data.summary.wonLeads,
                    activeLeads: data.summary.activeLeads,
                    conversionRate: data.summary.conversionRate,
                  }
                : undefined,
              chat: appsInsights?.chat
                ? {
                    totalConversations: appsInsights.chat.totalConversations,
                    totalMessages: appsInsights.chat.totalMessages,
                    attendedConversations:
                      appsInsights.chat.attendedConversations,
                    attendanceRate: appsInsights.chat.attendanceRate,
                  }
                : undefined,
              forge: appsInsights?.forge
                ? {
                    totalProposals: appsInsights.forge.totalProposals,
                    pagas: appsInsights.forge.pagas,
                    revenueTotal: appsInsights.forge.revenueTotal,
                  }
                : undefined,
              spacetime: appsInsights?.spacetime
                ? {
                    total: appsInsights.spacetime.total,
                    confirmed: appsInsights.spacetime.confirmed,
                    done: appsInsights.spacetime.done,
                  }
                : undefined,
              nasaPlanner: appsInsights?.nasaPlanner
                ? {
                    total: appsInsights.nasaPlanner.total,
                    published: appsInsights.nasaPlanner.published,
                    starsSpent: appsInsights.nasaPlanner.starsSpent,
                  }
                : undefined,
              metaAds:
                metaInsights?.connected && metaInsights.data
                  ? {
                      spend: metaInsights.data.spend,
                      leads: metaInsights.data.leads,
                      cpl: metaInsights.data.cpl,
                      roas: metaInsights.data.roas,
                    }
                  : undefined,
              filters: {
                trackingId,
                organizationIds,
                tagIds,
                dateRange,
              },
              modules: selectedModules,
            }}
          />
          <LayoutEditToolbar />

          {/* App Selector */}
          <AppSelector
            selected={selectedModules}
            onChange={setSelectedModules}
          />

          {/* Filters — tracking/tags only when tracking module selected */}
          <DashboardFilters
            trackingId={showTrackingFilters ? trackingId || "ALL" : undefined}
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
          <TabsList className="overflow-x-auto w-full justify-start">
            <TabsTrigger value="general">Visão Geral</TabsTrigger>
            {showTrackingFilters && (
              <TabsTrigger value="tracking">📊 Tracking</TabsTrigger>
            )}
            {selectedModules.includes("chat") && (
              <TabsTrigger value="atendiment">💬 Atendimento</TabsTrigger>
            )}
            {selectedModules.includes("integrations") && (
              <TabsTrigger value="channels">📡 Canais</TabsTrigger>
            )}
          </TabsList>
        </div>

        <div className="px-2 sm:px-6">
          {/* ── VISÃO GERAL CRUZADA ──────────────────────────────────────────── */}
          <TabsContent
            value="general"
            className="flex-1 overflow-y-auto pt-6 space-y-8 "
          >
            {/* Customizable Chart — full width between tabs and CrossDataOverview */}
            <CustomizableChart
              selectedModules={selectedModules}
              tracking={
                data?.summary
                  ? {
                      totalLeads: data.summary.totalLeads,
                      wonLeads: data.summary.wonLeads,
                      activeLeads: data.summary.activeLeads,
                    }
                  : undefined
              }
              chat={
                appsInsights?.chat
                  ? {
                      totalConversations: appsInsights.chat.totalConversations,
                      totalMessages: appsInsights.chat.totalMessages,
                      attendedConversations:
                        appsInsights.chat.attendedConversations,
                      unattendedConversations:
                        appsInsights.chat.unattendedConversations,
                    }
                  : undefined
              }
              forge={
                appsInsights?.forge
                  ? {
                      totalProposals: appsInsights.forge.totalProposals,
                      rascunho: appsInsights.forge.rascunho,
                      enviadas: appsInsights.forge.enviadas,
                      visualizadas: appsInsights.forge.visualizadas,
                      pagas: appsInsights.forge.pagas,
                      expiradas: appsInsights.forge.expiradas,
                      canceladas: appsInsights.forge.canceladas,
                      revenueTotal: appsInsights.forge.revenueTotal,
                      revenuePipeline: appsInsights.forge.revenuePipeline,
                    }
                  : undefined
              }
              spacetime={
                appsInsights?.spacetime
                  ? {
                      total: appsInsights.spacetime.total,
                      pending: appsInsights.spacetime.pending,
                      confirmed: appsInsights.spacetime.confirmed,
                      done: appsInsights.spacetime.done,
                      cancelled: appsInsights.spacetime.cancelled,
                      noShow: appsInsights.spacetime.noShow,
                    }
                  : undefined
              }
              nasaPlanner={
                appsInsights?.nasaPlanner
                  ? {
                      total: appsInsights.nasaPlanner.total,
                      draft: appsInsights.nasaPlanner.draft,
                      published: appsInsights.nasaPlanner.published,
                      scheduled: appsInsights.nasaPlanner.scheduled,
                    }
                  : undefined
              }
              metaAds={
                metaInsights?.connected && metaInsights.data
                  ? {
                      spend: metaInsights.data.spend,
                      roas: metaInsights.data.roas,
                      leads: metaInsights.data.leads,
                      clicks: metaInsights.data.clicks,
                      impressions: metaInsights.data.impressions,
                    }
                  : undefined
              }
            />

            {/* AI Report + PDF Download */}
            <InsightReport
              selectedModules={selectedModules}
              period={{
                startDate: appsInput.startDate,
                endDate: appsInput.endDate,
              }}
              orgName={organizatins[0]?.name ?? "Minha Empresa"}
              tracking={
                data?.summary
                  ? {
                      totalLeads: data.summary.totalLeads,
                      wonLeads: data.summary.wonLeads,
                      activeLeads: data.summary.activeLeads,
                      conversionRate: data.summary.conversionRate,
                    }
                  : undefined
              }
              chat={appsInsights?.chat}
              forge={appsInsights?.forge}
              spacetime={appsInsights?.spacetime}
              nasaPlanner={appsInsights?.nasaPlanner}
              metaAds={
                metaInsights?.connected && metaInsights.data
                  ? {
                      spend: metaInsights.data.spend,
                      roas: metaInsights.data.roas,
                      leads: metaInsights.data.leads,
                      clicks: metaInsights.data.clicks,
                      impressions: metaInsights.data.impressions,
                      ctr: metaInsights.data.ctr,
                      cpl: metaInsights.data.cpl,
                    }
                  : undefined
              }
            />

            <CrossDataOverview
              selectedModules={selectedModules}
              tracking={
                data?.summary
                  ? {
                      totalLeads: data.summary.totalLeads,
                      wonLeads: data.summary.wonLeads,
                      conversionRate: data.summary.conversionRate,
                      activeLeads: data.summary.activeLeads,
                    }
                  : undefined
              }
              chat={
                appsInsights?.chat
                  ? {
                      totalConversations: appsInsights.chat.totalConversations,
                      totalMessages: appsInsights.chat.totalMessages,
                      attendedConversations:
                        appsInsights.chat.attendedConversations,
                      attendanceRate: appsInsights.chat.attendanceRate,
                    }
                  : undefined
              }
              forge={
                appsInsights?.forge
                  ? {
                      totalProposals: appsInsights.forge.totalProposals,
                      pagas: appsInsights.forge.pagas,
                      revenueTotal: appsInsights.forge.revenueTotal,
                      revenuePipeline: appsInsights.forge.revenuePipeline,
                    }
                  : undefined
              }
              spacetime={
                appsInsights?.spacetime
                  ? {
                      total: appsInsights.spacetime.total,
                      done: appsInsights.spacetime.done,
                      conversionRate: appsInsights.spacetime.conversionRate,
                    }
                  : undefined
              }
              nasaPlanner={
                appsInsights?.nasaPlanner
                  ? {
                      total: appsInsights.nasaPlanner.total,
                      published: appsInsights.nasaPlanner.published,
                    }
                  : undefined
              }
              metaAds={
                metaInsights?.connected && metaInsights.data
                  ? {
                      spend: metaInsights.data.spend,
                      roas: metaInsights.data.roas,
                      leads: metaInsights.data.leads,
                      cpl: metaInsights.data.cpl,
                    }
                  : undefined
              }
            />

            <CrossInsightsPanel />

            {/* App-specific sections + tags + métricas — drag & drop unificado */}
            <SortableDashboardSections
              selectedModules={selectedModules}
              sections={{
                tracking: null,
                chat: null,
                forge: appsInsights?.forge ? <ForgeSection data={appsInsights.forge} /> : null,
                spacetime: appsInsights?.spacetime ? <SpacetimeSection data={appsInsights.spacetime} /> : null,
                "nasa-planner": appsInsights?.nasaPlanner ? <NasaPlannerSection data={appsInsights.nasaPlanner} /> : null,
                integrations: <IntegrationsSection metaAds={metaInsights ?? undefined} />,
                workspace: appsInsights?.workspace ? <WorkspaceSection data={appsInsights.workspace} /> : null,
                forms: appsInsights?.forms ? <FormsSection data={appsInsights.forms} /> : null,
                nbox: appsInsights?.nbox ? <NBoxSection data={appsInsights.nbox} /> : null,
                payment: appsInsights?.payment ? <PaymentSection data={appsInsights.payment} /> : null,
                linnker: appsInsights?.linnker ? <LinnkerSection data={appsInsights.linnker} /> : null,
                "space-points": appsInsights?.spacePoints ? <SpacePointsSection data={appsInsights.spacePoints} /> : null,
                stars: appsInsights?.stars ? <StarsSection data={appsInsights.stars} /> : null,
                "space-station": appsInsights?.spaceStation ? <SpaceStationSection data={appsInsights.spaceStation} /> : null,
                "nasa-route": appsInsights?.nasaRoute ? <NasaRouteSection data={appsInsights.nasaRoute} /> : null,
              }}
              renderTagTile={(b) => (
                <WidgetTag
                  title={b.title ?? "Tag"}
                  tagId={b.tagId}
                  organizationId={organizationIds[0] ?? ""}
                  id={b.id}
                  organizationIds={organizationIds}
                />
              )}
              renderAppMetric={(b) => (
                <AppMetricCard
                  blockId={b.id}
                  appSlug={b.appSlug}
                  metricKey={b.metricKey}
                  label={b.label}
                />
              )}
              renderAddAnchor={() => (
                <AddInsightButton organizationIds={organizationIds} />
              )}
            />

            <WidgetList organizationIds={organizationIds} />
          </TabsContent>

          {/* ── TRACKING ─────────────────────────────────────────────────────── */}
          {showTrackingFilters && (
            <TabsContent
              value="tracking"
              className="flex-1 overflow-y-auto pt-6 space-y-6"
            >
              {settings.visibleSections.summary && (
                <section>
                  <h2 className="mb-4 text-lg font-semibold">
                    Leads & Pipeline
                  </h2>
                  {isLoading ? (
                    <KPISkeleton />
                  ) : (
                    <KPIGeneralCards summary={data.summary} />
                  )}
                </section>
              )}
              <div className={cn("grid gap-6 lg:grid-cols-2")}>
                {settings.visibleSections.byStatus &&
                  (isLoading ? (
                    <ChartSkeleton />
                  ) : (
                    <ChartWrapper
                      title="Leads por Status"
                      description="Distribuição por status atual"
                      chartType={settings.chartTypes.byStatus}
                      onChartTypeChange={(type) =>
                        setChartType("byStatus", type)
                      }
                      isVisible={settings.visibleSections.byStatus}
                      onVisibilityToggle={() => toggleSection("byStatus")}
                    >
                      <StatusChart
                        data={data.byStatus}
                        chartType={settings.chartTypes.byStatus}
                        onClick={handleChartClick}
                      />
                    </ChartWrapper>
                  ))}
                {settings.visibleSections.byChannel &&
                  (isLoading ? (
                    <ChartSkeleton />
                  ) : (
                    <ChartWrapper
                      title="Leads por Canal"
                      description="Origem dos leads por canal"
                      chartType={settings.chartTypes.byChannel}
                      onChartTypeChange={(type) =>
                        setChartType("byChannel", type)
                      }
                      isVisible={settings.visibleSections.byChannel}
                      onVisibilityToggle={() => toggleSection("byChannel")}
                    >
                      <ChannelChart
                        data={data.byChannel}
                        chartType={settings.chartTypes.byChannel}
                        onClick={handleChartClick}
                      />
                    </ChartWrapper>
                  ))}
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
                        onClick={handleChartClick}
                      />
                    </ChartWrapper>
                  ))}
                {settings.visibleSections.topTags &&
                  (isLoading ? (
                    <ChartSkeleton />
                  ) : (
                    <ChartWrapper
                      title="Top Tags"
                      description="Tags mais utilizadas nos leads"
                      chartType={settings.chartTypes.topTags}
                      onChartTypeChange={(type) =>
                        setChartType("topTags", type)
                      }
                      isVisible={settings.visibleSections.topTags}
                      onVisibilityToggle={() => toggleSection("topTags")}
                    >
                      <TagsChart
                        data={data.topTags}
                        chartType={settings.chartTypes.topTags}
                        onClick={handleChartClick}
                      />
                    </ChartWrapper>
                  ))}
              </div>
            </TabsContent>
          )}

          {/* ── ATENDIMENTO ───────────────────────────────────────────────────── */}
          {selectedModules.includes("chat") && (
            <TabsContent
              value="atendiment"
              className="flex-1 overflow-y-auto pt-6 space-y-6"
            >
              <h2 className="mb-4 text-lg font-semibold">Atendimento</h2>
              <KPIAtendimentCards summary={data.summary} />
            </TabsContent>
          )}

          {/* ── CANAIS ────────────────────────────────────────────────────────── */}
          {selectedModules.includes("integrations") && (
            <TabsContent
              value="channels"
              className="flex-1 overflow-y-auto pt-6"
            >
              <ChannelInsights />
            </TabsContent>
          )}
        </div>
      </div>

      <div className="px-2 sm:px-6">
        <ListLeadByRelatoryModal
          isOpen={isModalOpen}
          onOpenChange={setIsModalOpen}
          leadIds={selectedLeadIds}
        />
      </div>
    </Tabs>
    </OrgLayoutProvider>
  );
}
