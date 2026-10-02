"use client";

import { SnapshotSection } from "@/features/insights/components/snapshot-section";
import { StatusChart } from "@/features/insights/components/charts/status-chart";
import { ChannelChart } from "@/features/insights/components/charts/channel-chart";
import { AttendantChart } from "@/features/insights/components/charts/attendant-chart";
import { TagsChart } from "@/features/insights/components/charts/tags-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ALL_MODULES,
  type AppModule,
  type StatusData,
  type ChannelData,
  type AttendantData,
  type TagData,
} from "@/features/insights/types";
import { getDefaultVisibleKeys } from "@/features/insights/lib/insights-metric-catalog";
import type { ChartsSnapshot } from "@/features/insights/hooks/use-charts-snapshot";
import { FrozenChartCard } from "@/features/insights/components/cross-chart/frozen-chart-card";
import { CrossInsightTiles } from "@/features/insights/components/cross-insight-tiles";
import type { KpiCardStyle } from "@/features/insights/lib/kpi-card-style";

interface PublicReportClientProps {
  snapshot: Record<string, unknown>;
  modules: string[];
}

/**
 * Renderiza o conteúdo de um relatório salvo na página pública.
 *
 * Faz isso a partir do snapshot persistido — espera o shape novo
 * (`apps`, `summary`, `charts`, `sectionPrefs`) mas também tem fallback
 * pro shape antigo (campos por app no nível raiz) pra preservar
 * relatórios já salvos antes desta feature.
 */
export function PublicReportClient({
  snapshot,
  modules,
}: PublicReportClientProps) {
  const sectionPrefs =
    (snapshot.sectionPrefs as Record<string, string[]>) ?? {};
  const sectionCardStyles = (snapshot.sectionCardStyles ?? {}) as Record<string, Record<string, KpiCardStyle>>;
  const apps = (snapshot.apps as Record<string, unknown>) ?? {};
  const summary = snapshot.summary as Record<string, unknown> | undefined;
  const metaAds = snapshot.metaAds as Record<string, unknown> | undefined;
  // Gráficos congelados no momento do salvamento (relatórios antigos não têm — seções ficam só com cartões).
  const crossChart = snapshot.crossChart as ChartsSnapshot["crossChart"];
  const appCharts = (snapshot.appCharts ?? {}) as ChartsSnapshot["appCharts"];
  const charts = snapshot.charts as
    | {
        byStatus?: Array<{ name: string; value: number; fill?: string }>;
        byChannel?: Array<{ name: string; value: number; fill?: string }>;
        byAttendant?: Array<{ name: string; value: number; fill?: string }>;
        topTags?: Array<{ name: string; value: number; fill?: string }>;
      }
    | undefined;

  // O snapshot guarda os charts no formato simplificado `{ name, value, fill }`
  // para reduzir tamanho. Adaptamos de volta pro shape esperado pelos
  // componentes de chart (que esperam o domínio completo).
  const toStatusData = (
    arr: Array<{ name: string; value: number; fill?: string }>,
  ): StatusData[] =>
    arr.map((it, i) => ({
      status: { id: String(i), name: it.name, color: it.fill ?? null },
      count: it.value,
      leadIds: [],
    }));

  const toChannelData = (
    arr: Array<{ name: string; value: number; fill?: string }>,
  ): ChannelData[] =>
    arr.map((it) => ({ source: it.name, count: it.value, leadIds: [] }));

  const toAttendantData = (
    arr: Array<{ name: string; value: number; fill?: string }>,
  ): AttendantData[] =>
    arr.map((it, i) => ({
      responsible: { id: String(i), name: it.name, image: null },
      isUnassigned: false,
      total: it.value,
      won: 0,
      leadIds: [],
    }));

  const toTagData = (
    arr: Array<{ name: string; value: number; fill?: string }>,
  ): TagData[] =>
    arr.map((it, i) => ({
      tag: { id: String(i), name: it.name, color: it.fill ?? null },
      count: it.value,
      leadIds: [],
    }));

  // Lista de apps a renderizar: usa `modules` do relatório se disponível,
  // senão renderiza todos os apps que têm dados no snapshot.
  const selectedModules: AppModule[] =
    modules && modules.length > 0
      ? (modules.filter((m) =>
          ALL_MODULES.includes(m as AppModule),
        ) as AppModule[])
      : ALL_MODULES;

  // Mapeia AppModule pro objeto de dados no snapshot.
  const dataForModule = (m: AppModule): Record<string, unknown> => {
    switch (m) {
      case "tracking":
        return {
          summary: summary ?? snapshot.tracking ?? {},
          // tracking-performance não é capturado hoje no snapshot — KPIs
          // de performance ficam vazios em relatórios.
          trackingPerformance: snapshot.trackingPerformance ?? {},
          // Indicadores extras do Tracking (conversão, valores, origem, perdas).
          tracking: apps.tracking ?? {},
        };
      case "forge":
        return { forge: apps.forge ?? snapshot.forge ?? {} };
      case "spacetime":
        return { spacetime: apps.spacetime ?? snapshot.spacetime ?? {} };
      case "chat":
        return { chat: apps.chat ?? snapshot.chat ?? {} };
      case "nasa-planner":
        return { nasaPlanner: apps.nasaPlanner ?? snapshot.nasaPlanner ?? {} };
      case "workspace":
        return { workspace: apps.workspace ?? {} };
      case "forms":
        return { forms: apps.forms ?? {} };
      case "nbox":
        return { nbox: apps.nbox ?? {} };
      case "payment":
        return { payment: apps.payment ?? {} };
      case "linnker":
        return { linnker: apps.linnker ?? {} };
      case "space-points":
        return { spacePoints: apps.spacePoints ?? {} };
      case "stars":
        return { stars: apps.stars ?? {} };
      case "space-station": {
        const ss = apps.spaceStation as Record<string, unknown> | undefined;
        return {
          spaceStation: {
            stations: ss?.totalStations ?? 0,
            publicStations: ss?.publicStations ?? 0,
            starsSent: ss?.starsSentInPeriod ?? 0,
            starsReceived: ss?.starsReceivedInPeriod ?? 0,
            pendingAccessRequests: ss?.pendingAccessRequests ?? 0,
            approvedAccessRequests: ss?.approvedAccessRequests ?? 0,
          },
        };
      }
      case "nasa-route": {
        const nr = apps.nasaRoute as Record<string, unknown> | undefined;
        return {
          nasaRoute: {
            courses: nr?.totalCourses ?? 0,
            students: nr?.totalStudents ?? 0,
            enrollmentsPaid: nr?.paidEnrollments ?? 0,
            revenueStars: nr?.starsRevenue ?? 0,
            completed: nr?.completedCourses ?? 0,
            certificates: nr?.certificatesIssued ?? 0,
            completionRate: nr?.completionRate ?? 0,
            avgTimeToCertificate: nr?.avgTimeToCertificate ?? 0,
            topCourses: nr?.topCourses ?? [],
            completedLessons: nr?.completedLessons ?? 0,
            freeEnrollments: nr?.freeEnrollments ?? 0,
            revenueBrl: nr?.revenueBrl ?? 0,
          },
        };
      }
      case "campanhas":
        return { campanhas: apps.campanhas ?? {} };
      case "trafego":
        return { trafego: apps.trafego ?? {} };
      case "nerp":
        return { nerp: apps.nerp ?? {} };
      case "star-friends":
        return { starFriends: apps.starFriends ?? {} };
      case "integrations":
        return { metaAds: metaAds ?? {} };
      default:
        return {};
    }
  };

  return (
    <div className="space-y-8">
      {crossChart && <FrozenChartCard chart={crossChart} globalType={crossChart.globalType} heightPx={320} />}

      <CrossInsightTiles
        tracking={summary as never}
        chat={apps.chat as never}
        forge={apps.forge as never}
        spacetime={apps.spacetime as never}
        metaAds={metaAds as never}
      />

      {/* Cards KPI por app — na ordem e com os indicadores salvos — e o gráfico de cada App congelado. */}
      {selectedModules.map((appModule) => {
        const visibleKeys =
          sectionPrefs[appModule] ?? getDefaultVisibleKeys(appModule);
        const appChart = appCharts[appModule];
        if (visibleKeys.length === 0 && !appChart) return null;
        return (
          <div key={appModule} className="space-y-3">
            <SnapshotSection
              appModule={appModule}
              data={dataForModule(appModule)}
              visibleKeys={visibleKeys}
              cardStyles={sectionCardStyles[appModule]}
            />
            {appChart && <FrozenChartCard chart={appChart} />}
          </div>
        );
      })}

      {/* Gráficos do Tracking — só renderiza quando o módulo tracking
          está selecionado E o snapshot tem dados de gráfico capturados. */}
      {selectedModules.includes("tracking") && charts && (
        <div className="grid gap-4 lg:grid-cols-2">
          {charts.byStatus && charts.byStatus.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Leads por Status</CardTitle>
              </CardHeader>
              <CardContent>
                <StatusChart data={toStatusData(charts.byStatus)} chartType="bar" />
              </CardContent>
            </Card>
          )}
          {charts.byChannel && charts.byChannel.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Leads por Canal</CardTitle>
              </CardHeader>
              <CardContent>
                <ChannelChart data={toChannelData(charts.byChannel)} chartType="pie" />
              </CardContent>
            </Card>
          )}
          {charts.byAttendant && charts.byAttendant.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Performance por Atendente
                </CardTitle>
              </CardHeader>
              <CardContent>
                <AttendantChart data={toAttendantData(charts.byAttendant)} chartType="bar" />
              </CardContent>
            </Card>
          )}
          {charts.topTags && charts.topTags.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top Tags</CardTitle>
              </CardHeader>
              <CardContent>
                <TagsChart data={toTagData(charts.topTags)} chartType="bar" />
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
