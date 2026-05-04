"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowDownIcon, ArrowUpIcon, MinusIcon, Trash2Icon } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { orpc } from "@/lib/orpc";
import { cn } from "@/lib/utils";
import {
  APP_METRIC_LABELS,
  findMetricDef,
  type AppMetricSource,
} from "@/lib/insights/app-metrics";
import { useOrgLayout } from "@/features/insights/context/org-layout-provider";
import { useDashboardStore } from "@/features/insights/hooks/use-dashboard-store";

interface AppMetricCardProps {
  blockId: string;
  appSlug: AppMetricSource;
  metricKey: string;
  label?: string;
}

function formatValue(
  value: number,
  unit?: "count" | "percent" | "currency",
): string {
  if (unit === "currency") {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    }).format(value);
  }
  if (unit === "percent") return `${value.toFixed(1)}%`;
  return new Intl.NumberFormat("pt-BR").format(value);
}

export function AppMetricCard({
  blockId,
  appSlug,
  metricKey,
  label,
}: AppMetricCardProps) {
  const { dateRange } = useDashboardStore();
  const { removeBlock, canEdit } = useOrgLayout();

  const def = findMetricDef(appSlug, metricKey);
  const displayLabel = label ?? def?.label ?? metricKey;

  const { data, isLoading } = useQuery(
    orpc.insights.getAppMetric.queryOptions({
      input: {
        appSlug,
        metricKey,
        dateRange: {
          from: dateRange.from?.toISOString(),
          to: dateRange.to?.toISOString(),
        },
      },
    }),
  );

  const trendIcon =
    data?.trend === "up" ? (
      <ArrowUpIcon className="size-3" />
    ) : data?.trend === "down" ? (
      <ArrowDownIcon className="size-3" />
    ) : (
      <MinusIcon className="size-3" />
    );

  const trendClass =
    data?.trend === "up"
      ? "text-emerald-600"
      : data?.trend === "down"
        ? "text-red-600"
        : "text-muted-foreground";

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
        <div className="flex flex-col">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            {APP_METRIC_LABELS[appSlug]}
          </span>
          <span className="text-sm font-medium">{displayLabel}</span>
        </div>
        {canEdit && (
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => removeBlock(blockId)}
            className="opacity-0 group-hover/section:opacity-100 hover:bg-destructive/10 transition-opacity"
            aria-label="Remover métrica"
          >
            <Trash2Icon className="size-4" />
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {isLoading || !data ? (
          <Skeleton className="h-9 w-24" />
        ) : (
          <div className="flex items-end justify-between gap-2">
            <span className="text-3xl font-bold tracking-tight">
              {formatValue(data.value, data.unit)}
            </span>
            <div
              className={cn(
                "flex items-center gap-1 text-xs font-medium",
                trendClass,
              )}
            >
              {trendIcon}
              <span>
                {data.delta == null
                  ? "—"
                  : `${data.delta > 0 ? "+" : ""}${data.delta.toFixed(1)}%`}
              </span>
            </div>
          </div>
        )}
        {data?.previousValue != null && data.previousValue !== 0 && (
          <p className="mt-1 text-xs text-muted-foreground">
            vs {formatValue(data.previousValue, data.unit)} no período anterior
          </p>
        )}
      </CardContent>
    </Card>
  );
}
