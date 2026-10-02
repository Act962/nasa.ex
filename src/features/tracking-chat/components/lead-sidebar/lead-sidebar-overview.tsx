"use client";

import { useState, type ReactNode } from "react";
import { ArrowDownIcon, ArrowUpIcon, AwardIcon, BarChart3Icon, ChevronRightIcon, SparklesIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  behaviorMetrics,
  serviceMetrics,
  type LeadMetricsView,
  type MetricDisplay,
  type MetricTrend,
} from "@/features/leads/components/lead-audit/metric-format";

// "Visão do Lead" e "Qualidade do Atendimento" da lateral do chat: cartões retraídos,
// valores sem cor e seta neutra de bom/ruim (leiaute v2 de 2026-09-29).

function OverviewCard({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <section className="overflow-hidden rounded-2xl border bg-muted/20">
      <button
        type="button"
        onClick={() => setIsOpen((previous) => !previous)}
        className={cn("flex w-full items-center gap-3 px-4 py-3 text-left", isOpen && "border-b")}
        aria-expanded={isOpen}
      >
        <span className="text-foreground/80">{icon}</span>
        <span className="flex-1 text-sm font-light tracking-wide">{title}</span>
        <ChevronRightIcon className={cn("size-4 text-muted-foreground transition-transform", isOpen && "rotate-90")} />
      </button>
      {isOpen && children}
    </section>
  );
}

function TrendArrow({ trend }: { trend?: MetricTrend }) {
  if (!trend) return null;
  const Arrow = trend === "up" ? ArrowUpIcon : ArrowDownIcon;
  return <Arrow className="size-3.5 shrink-0 text-muted-foreground" aria-label={trend === "up" ? "bom" : "ruim"} />;
}

function MetricCell({ metric }: { metric: MetricDisplay }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex min-w-0 flex-col gap-2 px-3 py-3">
          <span className="truncate text-xs text-muted-foreground">{metric.label}</span>
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-lg leading-none font-medium tabular-nums text-foreground">{metric.value}</span>
            <TrendArrow trend={metric.trend} />
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent>{metric.description}</TooltipContent>
    </Tooltip>
  );
}

export function LeadSidebarOverview({ metrics }: { metrics: LeadMetricsView }) {
  const behavior = behaviorMetrics(metrics);
  const service = serviceMetrics(metrics);
  const behaviorRows = [behavior.slice(0, 3), behavior.slice(3, 6)];

  return (
    <div className="flex flex-col gap-3 px-4">
      <OverviewCard title="Visão do Lead" icon={<BarChart3Icon className="size-5" />}>
        <div className="divide-y px-1">
          {behaviorRows.map((row, rowIndex) => (
            <div key={rowIndex} className="grid grid-cols-3 divide-x">
              {row.map((metric) => (
                <MetricCell key={metric.id} metric={metric} />
              ))}
            </div>
          ))}
        </div>
      </OverviewCard>

      <OverviewCard title="Qualidade do Atendimento" icon={<AwardIcon className="size-5" />}>
        <div className="grid grid-cols-3 divide-x px-1">
          {service.map((metric) => (
            <MetricCell key={metric.id} metric={metric} />
          ))}
        </div>
      </OverviewCard>

      <p className="flex items-start gap-1 px-1 text-[11px] leading-snug text-muted-foreground">
        {metrics.source === "AI" && <SparklesIcon className="mt-0.5 size-3 shrink-0 text-info" />}
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
