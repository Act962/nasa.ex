"use client";

import { SparklesIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { behaviorMetrics, potentialColor, serviceMetrics, type LeadMetricsView, type MetricDisplay } from "./metric-format";

// Cartões do "Auditar Lead": mesma altura, título curto numa linha, cor só
// onde há significado (bom, atenção, ruim) — spec 0035.

export function MetricCard({ metric, potential }: { metric: MetricDisplay; potential?: number }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex h-[72px] min-w-0 flex-col justify-between rounded-xl border bg-muted/30 px-2.5 py-2">
          <span className="truncate text-[11px] font-medium text-muted-foreground">{metric.label}</span>
          <div className="flex flex-col gap-1">
            <div className="flex min-w-0 items-center gap-1.5">
              <metric.icon className={cn("size-3.5 shrink-0", metric.iconClassName)} />
              <span className={cn("truncate text-[15px] font-semibold leading-none tabular-nums", metric.valueClassName)}>
                {metric.value}
              </span>
            </div>
            {potential !== undefined && (
              <div className="h-1 w-full overflow-hidden rounded-full bg-foreground/10">
                <div className="h-full rounded-full" style={{ width: `${potential}%`, backgroundColor: potentialColor(potential) }} />
              </div>
            )}
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent>{metric.description}</TooltipContent>
    </Tooltip>
  );
}

function MetricSection({ title, metrics, potential }: { title: string; metrics: MetricDisplay[]; potential?: number }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
      <div className="grid grid-cols-3 gap-2">
        {metrics.map((metric) => (
          <MetricCard key={metric.id} metric={metric} potential={metric.id === "potential" ? potential : undefined} />
        ))}
      </div>
    </section>
  );
}

export function LeadAuditDetails({ metrics }: { metrics: LeadMetricsView }) {
  return (
    <div className="flex flex-col gap-4">
      <MetricSection title="Comportamento do lead" metrics={behaviorMetrics(metrics)} potential={metrics.purchasePotential} />
      <MetricSection title="Qualidade do atendimento" metrics={serviceMetrics(metrics)} />
      <p className="flex items-start gap-1 text-[10px] leading-snug text-muted-foreground">
        {metrics.source === "AI" && <SparklesIcon className="mt-0.5 size-3 shrink-0 text-violet-400" />}
        <span>
          {metrics.source === "AI"
            ? `Potencial e interesse estimados pelo ASTRO: ${metrics.aiRationale ?? ""}`
            : "Calculado a partir das conversas, propostas e histórico do lead."}{" "}
          Atualizado em {new Date(metrics.computedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}.
        </span>
      </p>
    </div>
  );
}
