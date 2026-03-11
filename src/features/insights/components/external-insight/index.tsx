"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

import { KPIGeneralCards } from "@/features/insights/components/kpi/general-cards";
import { KPIAtendimentCards } from "@/features/insights/components/kpi/atendiment-cards";
import { StatusChart } from "@/features/insights/components/charts/status-chart";
import { ChannelChart } from "@/features/insights/components/charts/channel-chart";
import { AttendantChart } from "@/features/insights/components/charts/attendant-chart";
import { TagsChart } from "@/features/insights/components/charts/tags-chart";

import { BarChart3, Building2, TrendingUp } from "lucide-react";
import { ErrorState } from "./error-state";
import { HeaderSkeleton, KPISkeleton } from "./skeletron";

// ─── Skeletons ──────────────────────────────────────────────────────────────

export default function PublicInsightReportPage() {
  const params = useParams<{
    organizationId: string;
    "insight-slug": string;
  }>();

  const organizationId = params.organizationId;
  const slug = params["insight-slug"];

  const { data, isLoading, isError, refetch } = useQuery(
    orpc.insights.publicOrganizationDashboard.queryOptions({
      input: { organizationId, slug },
    }),
  );

  if (isError) {
    return <ErrorState onRetry={() => refetch()} />;
  }

  const settings = (data?.share?.settings ?? {}) as {
    visibleSections?: {
      summary?: boolean;
      byStatus?: boolean;
      byChannel?: boolean;
      byAttendant?: boolean;
      topTags?: boolean;
    };
    chartTypes?: {
      byStatus?: string;
      byChannel?: string;
      byAttendant?: string;
      topTags?: string;
    };
  };

  const visibleSections = {
    summary: settings.visibleSections?.summary ?? true,
    byStatus: settings.visibleSections?.byStatus ?? true,
    byChannel: settings.visibleSections?.byChannel ?? true,
    byAttendant: settings.visibleSections?.byAttendant ?? true,
    topTags: settings.visibleSections?.topTags ?? true,
  };

  const chartTypes = {
    byStatus: (settings.chartTypes?.byStatus ?? "bar") as
      | "bar"
      | "pie"
      | "line"
      | "area"
      | "radial",
    byChannel: (settings.chartTypes?.byChannel ?? "pie") as
      | "bar"
      | "pie"
      | "line"
      | "area"
      | "radial",
    byAttendant: (settings.chartTypes?.byAttendant ?? "bar") as
      | "bar"
      | "pie"
      | "line"
      | "area"
      | "radial",
    topTags: (settings.chartTypes?.topTags ?? "bar") as
      | "bar"
      | "pie"
      | "line"
      | "area"
      | "radial",
  };

  return (
    <div className="min-h-screen bg-background">
      {/* ── Sticky Header ── */}
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            {/* Logo + org info */}
            <div className="flex items-center gap-3">
              {isLoading ? (
                <HeaderSkeleton />
              ) : (
                <>
                  {data?.organization?.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={data.organization.logo}
                      alt={data.organization.name}
                      className="h-10 w-10 rounded-xl object-cover"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-foreground/10">
                      <Building2 className="h-5 w-5 text-foreground" />
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {data?.organization?.name}
                    </p>
                    <h1 className="text-lg font-bold leading-tight">
                      {data?.share?.name ?? "Relatório de Insights"}
                    </h1>
                  </div>
                </>
              )}
            </div>

            {/* Badge "Powered by" */}
            <div className="hidden items-center gap-2 sm:flex">
              <Badge
                variant="secondary"
                className="gap-1.5 px-3 py-1 text-xs font-medium"
              >
                <TrendingUp className="h-3 w-3" />
                Relatório público
              </Badge>
            </div>
          </div>
        </div>
      </header>

      {/* ── Content ── */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Tabs defaultValue="general" className="space-y-6">
          {/* Tabs bar */}
          <TabsList>
            <TabsTrigger value="general" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Geral
            </TabsTrigger>
            <TabsTrigger value="atendiment" className="gap-2">
              Atendimento
            </TabsTrigger>
          </TabsList>

          {/* ── Aba Geral ── */}
          <TabsContent value="general" className="space-y-8">
            {/* KPI summary */}
            {visibleSections.summary && (
              <section aria-label="Resumo executivo">
                <h2 className="mb-4 text-lg font-semibold">Resumo</h2>
                {isLoading ? (
                  <KPISkeleton />
                ) : (
                  data?.summary && <KPIGeneralCards summary={data.summary} />
                )}
              </section>
            )}

            {/* Charts grid */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Status */}
              {visibleSections.byStatus && (
                <Card className="transition-all hover:shadow-md">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-semibold">
                      Leads por Status
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      Distribuição de leads por status atual
                    </p>
                  </CardHeader>
                  <CardContent>
                    {isLoading ? (
                      <Skeleton className="h-[300px] w-full" />
                    ) : (
                      data?.byStatus && (
                        <StatusChart
                          data={data.byStatus}
                          chartType={chartTypes.byStatus}
                        />
                      )
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Canal */}
              {visibleSections.byChannel && (
                <Card className="transition-all hover:shadow-md">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-semibold">
                      Leads por Canal
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      Origem dos leads por canal de aquisição
                    </p>
                  </CardHeader>
                  <CardContent>
                    {isLoading ? (
                      <Skeleton className="h-[300px] w-full" />
                    ) : (
                      data?.byChannel && (
                        <ChannelChart
                          data={data.byChannel}
                          chartType={chartTypes.byChannel}
                        />
                      )
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Atendente */}
              {visibleSections.byAttendant && (
                <Card className="transition-all hover:shadow-md">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-semibold">
                      Performance por Atendente
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      Total de leads e conversões por responsável
                    </p>
                  </CardHeader>
                  <CardContent>
                    {isLoading ? (
                      <Skeleton className="h-[300px] w-full" />
                    ) : (
                      data?.byAttendant && (
                        <AttendantChart
                          data={data.byAttendant}
                          chartType={chartTypes.byAttendant}
                        />
                      )
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Tags */}
              {visibleSections.topTags && (
                <Card className="transition-all hover:shadow-md">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-semibold">
                      Top Tags
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      Tags mais utilizadas nos leads
                    </p>
                  </CardHeader>
                  <CardContent>
                    {isLoading ? (
                      <Skeleton className="h-[300px] w-full" />
                    ) : (
                      data?.topTags && (
                        <TagsChart
                          data={data.topTags}
                          chartType={chartTypes.topTags}
                        />
                      )
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* ── Aba Atendimento ── */}
          <TabsContent value="atendiment" className="space-y-6">
            <h2 className="text-lg font-semibold">Atendimento</h2>
            {isLoading ? (
              <KPISkeleton />
            ) : (
              data?.summary && <KPIAtendimentCards summary={data.summary} />
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* ── Footer ── */}
      <footer className="mt-16 border-t py-6">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="text-center text-xs text-muted-foreground">
            Este relatório é público e foi compartilhado automaticamente. Os
            dados refletem a organização{" "}
            <strong>{data?.organization?.name ?? "—"}</strong>.
          </p>
        </div>
      </footer>
    </div>
  );
}
