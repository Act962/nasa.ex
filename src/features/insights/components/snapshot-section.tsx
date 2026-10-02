"use client";

import { cn } from "@/lib/utils";
import type { AppModule } from "@/features/insights/types";
import {
  METRIC_CATALOG,
  SECTION_META,
  resolveDataPath,
  formatMetricValue,
  toRankingItems,
  type MetricDef,
} from "@/features/insights/lib/insights-metric-catalog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { KpiCardStyle } from "@/features/insights/lib/kpi-card-style";
import { KpiCardShell } from "./kpi-card-shell";

/**
 * Renderiza uma seção de app a partir de um snapshot salvo —
 * versão read-only e sem dependência de `OrgLayoutProvider`. Usada na
 * página pública de relatório (`/insights/r/[token]`).
 *
 * Recebe `visibleKeys` direto (do `snapshot.sectionPrefs`) em vez de
 * ler do contexto. Sem botões de edição (+ Adicionar, X de ocultar).
 */
interface SnapshotSectionProps {
  appModule: AppModule;
  /** Payload completo do snapshot — usado pra resolveDataPath. */
  data: Record<string, unknown> | null | undefined;
  /** Lista de keys do catálogo que devem aparecer; vinda do snapshot. */
  visibleKeys: string[];
  /** Aparência de cada bloco no momento do salvamento. */
  cardStyles?: Record<string, KpiCardStyle>;
}

export function SnapshotSection({
  appModule,
  data,
  visibleKeys,
  cardStyles,
}: SnapshotSectionProps) {
  const meta = SECTION_META[appModule];
  const visibleMetrics: MetricDef[] = visibleKeys
    .map((k) => METRIC_CATALOG.find((m) => m.appModule === appModule && m.key === k))
    .filter((m): m is MetricDef => !!m);

  if (visibleMetrics.length === 0) return null;

  return (
    <div className="space-y-3">
      {meta && (
        <div className="flex items-center gap-3 mb-4">
          <div
            className={cn(
              "w-9 h-9 rounded-xl flex items-center justify-center",
              meta.bg,
            )}
          >
            <meta.icon className={cn("size-5", meta.color)} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold">{meta.label}</h3>
            {meta.description && (
              <p className="text-xs text-muted-foreground">{meta.description}</p>
            )}
          </div>
        </div>
      )}
      <div className="grid auto-rows-fr grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {visibleMetrics.map((metric) => {
          const Icon = metric.icon;
          const value = resolveDataPath(data, metric.dataPath);

          // KPIs com layout customizado (ranking, top criador)
          let customBody: React.ReactNode = null;
          if (metric.format === "ranking" && metric.ranking) {
            const rankingItems = toRankingItems(value);
            const { labelKey, valueKey, valueFormat } = metric.ranking;
            customBody =
              Array.isArray(rankingItems) && rankingItems.length > 0 ? (
                <div className="space-y-1.5">
                  {(rankingItems.slice(0, 5) as Array<Record<string, unknown>>).map((item, itemIndex) => (
                    <div key={itemIndex} className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate font-medium">
                        {itemIndex + 1}. {String(item[labelKey] ?? item.name ?? "—")}
                      </span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {formatMetricValue(item[valueKey] as number, valueFormat)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Sem dados no período</p>
              );
          } else if (metric.format === "ranking") {
            if (
              appModule === "workspace" &&
              metric.key === "topFastestCreator" &&
              value &&
              typeof value === "object"
            ) {
              const v = value as { name: string; avgHours: number; count: number };
              const initial = v.name?.[0]?.toUpperCase() ?? "?";
              customBody = (
                <div className="flex items-center gap-2">
                  <Avatar className="size-8">
                    <AvatarFallback className="text-xs">{initial}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold leading-tight truncate">
                      {v.name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Média {formatMetricValue(v.avgHours, "duration")} ·{" "}
                      {v.count} ações
                    </p>
                  </div>
                </div>
              );
            } else if (Array.isArray(value) && value.length > 0) {
              const items = value.slice(0, 5) as Array<Record<string, unknown>>;
              const metricKey =
                metric.key === "conversionRateByAttendant" ? "rate" : "avgHours";
              const format =
                metric.key === "conversionRateByAttendant" ? "percent" : "duration";
              customBody = (
                <div className="space-y-1.5">
                  {items.map((item, idx) => {
                    const lbl = (item.name ?? item.statusId ?? "—") as string;
                    const m = item[metricKey] as number;
                    return (
                      <div
                        key={idx}
                        className="flex items-center justify-between gap-2 text-xs"
                      >
                        <span className="truncate font-medium">
                          {idx + 1}. {lbl}
                        </span>
                        <span className="text-muted-foreground tabular-nums shrink-0">
                          {formatMetricValue(m, format)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              );
            } else {
              customBody = (
                <p className="text-sm text-muted-foreground">Sem dados</p>
              );
            }
          }

          return (
            <KpiCardShell
              key={metric.key}
              label={metric.label}
              value={formatMetricValue(value, metric.format)}
              sub={metric.description}
              icon={Icon}
              iconColor={metric.color}
              iconBg={metric.bg}
              cardStyle={cardStyles?.[metric.key]}
            >
              {customBody ?? undefined}
            </KpiCardShell>
          );
        })}
      </div>
    </div>
  );
}
