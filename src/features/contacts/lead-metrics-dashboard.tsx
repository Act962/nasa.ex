"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { MetricCard } from "@/features/leads/components/lead-audit/lead-audit-details";
import {
  behaviorMetrics,
  serviceMetrics,
  type LeadMetricsView,
  type MetricDisplay,
} from "@/features/leads/components/lead-audit/metric-format";
import { useLeadMetricsSummary } from "./hooks/use-lead-metrics-summary";

// Os 9 indicadores do "Auditar Lead" no painel de /contatos: médias (e a soma
// de compras) só dos leads já auditados, no mesmo recorte dos segmentos.

const INTEREST_LABELS = { LOW: "Baixo", MEDIUM: "Médio", HIGH: "Alto" } as const;

type SummaryFilters = Parameters<typeof useLeadMetricsSummary>[0];

export function LeadMetricsDashboard({ filters }: { filters: SummaryFilters }) {
  const { data, isLoading } = useLeadMetricsSummary(filters);

  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-2 lg:grid-cols-9">
        {Array.from({ length: 9 }).map((_, index) => (
          <Skeleton key={index} className="h-[72px] rounded-xl" />
        ))}
      </div>
    );
  }
  if (!data || data.auditedLeads === 0) {
    return (
      <p className="rounded-xl border border-dashed px-4 py-3 text-xs text-muted-foreground">
        Nenhum lead auditado neste recorte. Os indicadores de comportamento e atendimento aparecem aqui quando os leads
        forem auditados (botão "Auditar Lead" no chat ou no contato).
      </p>
    );
  }

  const { interestCounts } = data;
  const dominantInterest = (Object.keys(interestCounts) as (keyof typeof interestCounts)[]).reduce((best, level) =>
    interestCounts[level] > interestCounts[best] ? level : best,
  );
  const view: LeadMetricsView = {
    ...data,
    interestLevel: dominantInterest,
    source: "COMPUTED",
    aiRationale: null,
    computedAt: new Date(),
  };
  const averageNote = `média de ${data.auditedLeads} lead(s) auditado(s)`;
  const withContext = (metric: MetricDisplay): MetricDisplay => {
    if (metric.id === "purchases") return { ...metric, description: `Soma das compras de ${data.auditedLeads} lead(s) auditado(s)` };
    if (metric.id === "interest") {
      return {
        ...metric,
        description: `Predominante. Alto ${interestCounts.HIGH} · Médio ${interestCounts.MEDIUM} · Baixo ${interestCounts.LOW}`,
      };
    }
    return { ...metric, description: `${metric.description} — ${averageNote}` };
  };
  const metrics = [...behaviorMetrics(view), ...serviceMetrics(view)].map(withContext);

  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-medium text-muted-foreground">
        Comportamento e atendimento · {data.auditedLeads} lead(s) auditado(s) · predomina interesse{" "}
        {INTEREST_LABELS[dominantInterest].toLowerCase()}
      </p>
      <div className="grid grid-cols-3 gap-2 lg:grid-cols-9">
        {metrics.map((metric) => (
          <MetricCard
            key={metric.id}
            metric={metric}
            potential={metric.id === "potential" ? data.purchasePotential : undefined}
          />
        ))}
      </div>
    </div>
  );
}
