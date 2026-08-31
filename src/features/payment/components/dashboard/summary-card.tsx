"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowDownRight, ArrowUpRight, ListChecks, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPercent, variationBetween } from "../../lib/format";
import { KpiEntriesDialog, type KpiEntriesFilter } from "./kpi-entries-dialog";
import { TONE_CLASSES, type DashboardTone } from "./types";

type SummaryCardProps = {
  label: string;
  value: string;
  icon: React.ElementType;
  tone: DashboardTone;
  current: number;
  previous: number;
  /** Crescimento é bom? Falso em "Despesa"/"Gastos", onde subir é ruim. */
  higherIsBetter?: boolean;
  /** Habilita o botão de lista no canto, que abre os lançamentos do card. */
  filter?: KpiEntriesFilter;
  useSumOfPaid?: boolean;
};

export function SummaryCard({
  label,
  value,
  icon: Icon,
  tone,
  current,
  previous,
  higherIsBetter = true,
  filter,
  useSumOfPaid,
}: SummaryCardProps) {
  const [entriesOpen, setEntriesOpen] = useState(false);
  const toneClasses = TONE_CLASSES[tone];
  const variation = variationBetween(current, previous);

  const isPositive =
    variation.direction === "flat"
      ? null
      : (variation.direction === "up") === higherIsBetter;

  const VariationIcon =
    variation.direction === "up"
      ? ArrowUpRight
      : variation.direction === "down"
        ? ArrowDownRight
        : Minus;

  return (
    <>
      <Card className="relative gap-0 overflow-hidden py-0 transition-shadow hover:shadow-md">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "flex size-11 shrink-0 items-center justify-center rounded-xl",
                toneClasses.iconWrap,
              )}
            >
              <Icon className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {label}
              </p>
              <p
                className={cn(
                  "mt-1 truncate text-xl font-bold tabular-nums sm:text-2xl",
                  toneClasses.value,
                )}
                title={value}
              >
                {value}
              </p>
            </div>
            {filter && (
              <button
                type="button"
                onClick={() => setEntriesOpen(true)}
                className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label={`Ver lançamentos de ${label}`}
                title="Ver lançamentos"
              >
                <ListChecks className="size-4" />
              </button>
            )}
          </div>

          <div className="mt-3 flex items-center gap-1.5 border-t pt-3 text-xs">
            <VariationIcon
              className={cn(
                "size-3.5 shrink-0",
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
            <span className="truncate text-muted-foreground">
              vs. período anterior
            </span>
          </div>
        </CardContent>
      </Card>

      {filter && (
        <KpiEntriesDialog
          open={entriesOpen}
          onOpenChange={setEntriesOpen}
          title={label}
          filter={filter}
          accentClassName={toneClasses.value}
          useSumOfPaid={useSumOfPaid}
        />
      )}
    </>
  );
}
