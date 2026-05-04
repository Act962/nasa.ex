"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ExternalLinkIcon,
  MinusIcon,
} from "lucide-react";
import { orpc } from "@/lib/orpc";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  APP_METRIC_LABELS,
  findMetricDef,
  isAppMetricSource,
  type AppMetricSource,
  type InsightBlock,
} from "@/lib/insights/app-metrics";
import type { AppModule } from "@/features/insights/types";

interface AppPinnedInsightsStripProps {
  appModule: AppModule;
}

export function AppPinnedInsightsStrip({
  appModule,
}: AppPinnedInsightsStripProps) {
  const { data, isLoading } = useQuery(
    orpc.insights.getPinnedBlocksForApp.queryOptions({
      input: { appModule },
    }),
  );

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 px-2 sm:px-6 py-2">
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>
    );
  }

  const blocks = (data?.blocks ?? []) as InsightBlock[];
  const metricBlocks = blocks.filter(
    (b): b is Extract<InsightBlock, { type: "app-metric" }> =>
      b.type === "app-metric" && isAppMetricSource(b.appSlug),
  );

  if (metricBlocks.length === 0) return null;

  return (
    <div className="px-2 sm:px-6 py-3 border-b">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Insights fixados
        </span>
        <Link
          href="/insights"
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          <ExternalLinkIcon className="size-3" />
          Editar em Insights
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        {metricBlocks.map((b) => (
          <PinnedMetric key={b.id} block={b} />
        ))}
      </div>
    </div>
  );
}

function PinnedMetric({
  block,
}: {
  block: Extract<InsightBlock, { type: "app-metric" }>;
}) {
  const { data, isLoading } = useQuery(
    orpc.insights.getAppMetric.queryOptions({
      input: { appSlug: block.appSlug, metricKey: block.metricKey },
    }),
  );

  const def = findMetricDef(block.appSlug as AppMetricSource, block.metricKey);
  const label = block.label ?? def?.label ?? block.metricKey;

  const trendIcon =
    data?.trend === "up" ? (
      <ArrowUpIcon className="size-3" />
    ) : data?.trend === "down" ? (
      <ArrowDownIcon className="size-3" />
    ) : (
      <MinusIcon className="size-3" />
    );
  const trendColor =
    data?.trend === "up"
      ? "text-emerald-600"
      : data?.trend === "down"
        ? "text-red-600"
        : "text-muted-foreground";

  return (
    <Card className="border bg-card">
      <CardContent className="p-3 space-y-1">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {APP_METRIC_LABELS[block.appSlug as AppMetricSource]}
        </div>
        <div className="text-xs text-muted-foreground">{label}</div>
        {isLoading || !data ? (
          <Skeleton className="h-6 w-16" />
        ) : (
          <div className="flex items-end justify-between gap-1">
            <span className="text-xl font-bold">
              {formatValue(data.value, data.unit)}
            </span>
            <span className={cn("flex items-center gap-1 text-xs", trendColor)}>
              {trendIcon}
              {data.delta == null
                ? "—"
                : `${data.delta > 0 ? "+" : ""}${data.delta.toFixed(0)}%`}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
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
