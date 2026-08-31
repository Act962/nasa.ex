"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronRight,
  ListChecks,
  Minus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency, formatPercent, variationBetween } from "../../lib/format";
import { KpiEntriesDialog, type KpiEntriesFilter } from "./kpi-entries-dialog";
import { TONE_CLASSES, type DashboardTone } from "./types";

const GAUGE_RADIUS = 58;
const GAUGE_LENGTH = Math.PI * GAUGE_RADIUS;

export type ExecutiveMetric = {
  label: string;
  value: string;
  /** Variação vs período anterior. Ausente quando não há base comparável. */
  comparison?: { current: number; previous: number; higherIsBetter?: boolean };
  /** Texto fixo no lugar da variação (ex.: "Disponível"). */
  hint?: string;
  filter?: KpiEntriesFilter;
  useSumOfPaid?: boolean;
  /** Quando presente, o bloco inteiro vira botão (leva pra aba do assunto). */
  onSelect?: () => void;
  /** Cor do número. Sem isso o valor herda a cor do texto padrão. */
  tone?: DashboardTone;
};

function MetricItem({ metric }: { metric: ExecutiveMetric }) {
  const [entriesOpen, setEntriesOpen] = useState(false);
  const variation = metric.comparison
    ? variationBetween(metric.comparison.current, metric.comparison.previous)
    : null;

  const higherIsBetter = metric.comparison?.higherIsBetter ?? true;
  const isPositive =
    !variation || variation.direction === "flat"
      ? null
      : (variation.direction === "up") === higherIsBetter;

  const VariationIcon =
    variation?.direction === "up"
      ? ArrowUpRight
      : variation?.direction === "down"
        ? ArrowDownRight
        : Minus;

  const Wrapper = metric.onSelect ? "button" : "div";

  return (
    <>
      <Wrapper
        {...(metric.onSelect
          ? {
              type: "button" as const,
              onClick: metric.onSelect,
              title: `Abrir ${metric.label}`,
            }
          : {})}
        className={cn(
          "min-w-0",
          metric.onSelect &&
            "-m-2 rounded-lg p-2 text-left transition-colors hover:bg-muted",
        )}
      >
        <div className="flex items-center gap-1">
          <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {metric.label}
          </p>
          {metric.onSelect && (
            <ChevronRight className="size-3 shrink-0 text-muted-foreground" />
          )}
          {/* Nunca junto com onSelect — botão dentro de botão é HTML inválido. */}
          {metric.filter && !metric.onSelect && (
            <button
              type="button"
              onClick={() => setEntriesOpen(true)}
              className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label={`Ver lançamentos de ${metric.label}`}
              title="Ver lançamentos"
            >
              <ListChecks className="size-3" />
            </button>
          )}
        </div>
        <p
          className={cn(
            "mt-1 truncate text-lg font-bold tabular-nums",
            metric.tone && TONE_CLASSES[metric.tone].value,
          )}
          title={metric.value}
        >
          {metric.value}
        </p>
        {variation ? (
          <p className="mt-0.5 flex items-center gap-1 text-[11px]">
            <VariationIcon
              className={cn(
                "size-3 shrink-0",
                isPositive === null
                  ? "text-muted-foreground"
                  : isPositive
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-red-600 dark:text-red-400",
              )}
            />
            <span
              className={cn(
                "font-semibold tabular-nums",
                isPositive === null
                  ? "text-muted-foreground"
                  : isPositive
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-red-600 dark:text-red-400",
              )}
            >
              {variation.direction === "flat"
                ? "—"
                : formatPercent(variation.percent)}
            </span>
            <span className="truncate text-muted-foreground">vs. anterior</span>
          </p>
        ) : (
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
            {metric.hint}
          </p>
        )}
      </Wrapper>

      {metric.filter && !metric.onSelect && (
        <KpiEntriesDialog
          open={entriesOpen}
          onOpenChange={setEntriesOpen}
          title={metric.label}
          filter={metric.filter}
          useSumOfPaid={metric.useSumOfPaid}
        />
      )}
    </>
  );
}

function GoalGauge({
  achieved,
  target,
}: {
  achieved: number;
  target: number;
}) {
  const ratio = target > 0 ? Math.min(achieved / target, 1) : 0;
  const percent = target > 0 ? (achieved / target) * 100 : 0;
  const strokeColor =
    percent >= 70 ? "#10b981" : percent >= 40 ? "#f59e0b" : "#ef4444";

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative w-[160px]">
        <svg viewBox="0 0 140 78" className="w-full">
          <path
            d="M 12 70 A 58 58 0 0 1 128 70"
            fill="none"
            stroke="var(--muted)"
            strokeWidth={11}
            strokeLinecap="round"
          />
          <path
            d="M 12 70 A 58 58 0 0 1 128 70"
            fill="none"
            stroke={strokeColor}
            strokeWidth={11}
            strokeLinecap="round"
            strokeDasharray={GAUGE_LENGTH}
            strokeDashoffset={GAUGE_LENGTH * (1 - ratio)}
          />
        </svg>
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">
          <span className="text-xl font-bold tabular-nums">
            {formatPercent(percent, 0)}
          </span>
          <span className="text-[10px] text-muted-foreground">
            Meta do mês
          </span>
        </div>
      </div>
      <p className="mt-1 text-center text-[11px] tabular-nums text-muted-foreground">
        {formatCurrency(achieved)} / {formatCurrency(target)}
      </p>
    </div>
  );
}

export function ExecutiveSummaryCard({
  metrics,
  goalAchieved,
  goalTarget,
}: {
  metrics: ExecutiveMetric[];
  goalAchieved: number;
  goalTarget: number;
}) {
  return (
    <Card className="gap-0 py-0">
      <CardContent className="p-4 sm:p-5">
        <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center lg:gap-8">
          <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3 xl:grid-cols-4">
            {metrics.map((metric) => (
              <MetricItem key={metric.label} metric={metric} />
            ))}
          </div>
          <GoalGauge achieved={goalAchieved} target={goalTarget} />
        </div>
      </CardContent>
    </Card>
  );
}
