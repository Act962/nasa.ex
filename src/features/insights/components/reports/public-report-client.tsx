"use client";

import { SnapshotSection } from "@/features/insights/components/snapshot-section";
import { StatusChart } from "@/features/insights/components/charts/status-chart";
import { ChannelChart } from "@/features/insights/components/charts/channel-chart";
import { AttendantChart } from "@/features/insights/components/charts/attendant-chart";
import { TagsChart } from "@/features/insights/components/charts/tags-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ALL_MODULES, type AppModule } from "@/features/insights/types";
import { getDefaultVisibleKeys } from "@/features/insights/lib/insights-metric-catalog";

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
  const apps = (snapshot.apps as Record<string, unknown>) ?? {};
  const summary = snapshot.summary as Record<string, unknown> | undefined;
  const metaAds = snapshot.metaAds as Record<string, unknown> | undefined;
  const charts = snapshot.charts as
    | {
        byStatus?: Array<{ name: string; value: number; fill?: string }>;
        byChannel?: Array<{ name: string; value: number; fill?: string }>;
        byAttendant?: Array<{ name: string; value: number; fill?: string }>;
        topTags?: Array<{ name: string; value: number; fill?: string }>;
      }
    | undefined;

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
          },
        };
      }
      case "integrations":
        return { metaAds: metaAds ?? {} };
      default:
        return {};
    }
  };

  return (
    <div className="space-y-8">
      {/* Cards KPI por app — usando sectionPrefs salvas */}
      {selectedModules.map((appModule) => {
        const visibleKeys =
          sectionPrefs[appModule] ?? getDefaultVisibleKeys(appModule);
        if (visibleKeys.length === 0) return null;
        return (
          <SnapshotSection
            key={appModule}
            appModule={appModule}
            data={dataForModule(appModule)}
            visibleKeys={visibleKeys}
          />
        );
      })}

      {/* Gráficos do Tracking — só renderiza quando o módulo tracking
          está selecionado E o snapshot tem dados de gráfico capturados.
          Adapta o shape slim do snapshot pra rich type que os charts esperam
          (leadIds=[] porque snapshot não persiste IDs). */}
      {selectedModules.includes("tracking") && charts && (
        <div className="grid gap-4 lg:grid-cols-2">
          {charts.byStatus && charts.byStatus.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Leads por Status</CardTitle>
              </CardHeader>
              <CardContent>
                <StatusChart
                  data={charts.byStatus.map((item, i) => ({
                    status: {
                      id: `snapshot-${i}`,
                      name: item.name,
                      color: item.fill ?? null,
                    },
                    count: item.value,
                    leadIds: [],
                  }))}
                  chartType="bar"
                />
              </CardContent>
            </Card>
          )}
          {charts.byChannel && charts.byChannel.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Leads por Canal</CardTitle>
              </CardHeader>
              <CardContent>
                <ChannelChart
                  data={charts.byChannel.map((item) => ({
                    source: item.name,
                    count: item.value,
                    leadIds: [],
                  }))}
                  chartType="pie"
                />
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
                <AttendantChart
                  data={charts.byAttendant.map((item, i) => ({
                    responsible: {
                      id: `snapshot-${i}`,
                      name: item.name,
                      image: null,
                    },
                    isUnassigned: false,
                    total: item.value,
                    won: 0,
                    leadIds: [],
                  }))}
                  chartType="bar"
                />
              </CardContent>
            </Card>
          )}
          {charts.topTags && charts.topTags.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top Tags</CardTitle>
              </CardHeader>
              <CardContent>
                <TagsChart
                  data={charts.topTags.map((item, i) => ({
                    tag: {
                      id: `snapshot-${i}`,
                      name: item.name,
                      color: item.fill ?? null,
                    },
                    count: item.value,
                    leadIds: [],
                  }))}
                  chartType="bar"
                />
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
