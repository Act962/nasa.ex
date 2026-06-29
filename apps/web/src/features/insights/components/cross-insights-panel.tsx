"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertTriangleIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  Loader2Icon,
  MinusIcon,
  SparklesIcon,
  TrendingUpIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { orpc } from "@/lib/orpc";
import { useDashboardStore } from "@/features/insights/hooks/use-dashboard-store";

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

const SEVERITY_STYLES = {
  good: {
    border: "border-emerald-200 dark:border-emerald-900",
    bg: "bg-emerald-50/60 dark:bg-emerald-950/20",
    icon: "text-emerald-600",
    label: "Destaque",
  },
  warn: {
    border: "border-amber-200 dark:border-amber-900",
    bg: "bg-amber-50/60 dark:bg-amber-950/20",
    icon: "text-amber-600",
    label: "Atenção",
  },
  bad: {
    border: "border-red-200 dark:border-red-900",
    bg: "bg-red-50/60 dark:bg-red-950/20",
    icon: "text-red-600",
    label: "Alerta",
  },
  neutral: {
    border: "",
    bg: "",
    icon: "text-muted-foreground",
    label: "",
  },
} as const;

type Tile = {
  tileId: string;
  title: string;
  primaryValue: number;
  secondaryValue?: number;
  delta: number | null;
  trend: "up" | "down" | "flat";
  severity: keyof typeof SEVERITY_STYLES;
  narrative: string;
  unit?: "count" | "percent" | "currency";
};

export function CrossInsightsPanel() {
  const { dateRange } = useDashboardStore();

  const { data, isLoading } = useQuery(
    orpc.insights.getCrossInsights.queryOptions({
      input: {
        dateRange: {
          from: dateRange.from?.toISOString(),
          to: dateRange.to?.toISOString(),
        },
      },
    }),
  );

  if (isLoading) {
    return (
      <div className="space-y-3">
        <h2 className="text-sm font-semibold">Cruzamentos inteligentes</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (!data || data.tiles.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Cruzamentos inteligentes</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Indicadores cruzados com variação vs período anterior e narrativa
            operacional
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {data.tiles.map((t) => (
          <CrossTileCard key={t.tileId} tile={t as Tile} />
        ))}
      </div>
    </div>
  );
}

function CrossTileCard({ tile }: { tile: Tile }) {
  const [aiNarrative, setAiNarrative] = useState<string | null>(null);

  const generate = useMutation({
    ...orpc.insights.generateTileNarrative.mutationOptions(),
    onSuccess: (res) => setAiNarrative(res.narrative),
  });

  const sev = SEVERITY_STYLES[tile.severity];
  const trendIcon =
    tile.trend === "up" ? (
      <ArrowUpIcon className="size-3" />
    ) : tile.trend === "down" ? (
      <ArrowDownIcon className="size-3" />
    ) : (
      <MinusIcon className="size-3" />
    );
  const trendColor =
    tile.trend === "up"
      ? "text-emerald-600"
      : tile.trend === "down"
        ? "text-red-600"
        : "text-muted-foreground";

  return (
    <Card className={cn("border", sev.border, sev.bg)}>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <span className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
            {tile.title}
          </span>
          {tile.severity !== "neutral" && (
            <span
              className={cn(
                "flex items-center gap-1 text-[11px] font-medium",
                sev.icon,
              )}
            >
              {tile.severity === "good" ? (
                <SparklesIcon className="size-3" />
              ) : (
                <AlertTriangleIcon className="size-3" />
              )}
              {sev.label}
            </span>
          )}
        </div>
        <div className="flex items-end justify-between gap-2">
          <span className="text-3xl font-bold tracking-tight">
            {formatValue(tile.primaryValue, tile.unit)}
          </span>
          <span
            className={cn(
              "flex items-center gap-1 text-xs font-medium",
              trendColor,
            )}
          >
            {trendIcon}
            {tile.delta == null
              ? "—"
              : `${tile.delta > 0 ? "+" : ""}${tile.delta.toFixed(1)}%`}
          </span>
        </div>
        <p
          className={cn(
            "text-xs leading-snug whitespace-pre-line",
            aiNarrative ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {aiNarrative ?? tile.narrative}
        </p>
        {tile.secondaryValue != null && (
          <p className="text-[11px] text-muted-foreground/70 flex items-center gap-1">
            <TrendingUpIcon className="size-3" />
            Anterior: {formatValue(tile.secondaryValue, tile.unit)}
          </p>
        )}
        <div className="flex items-center justify-between pt-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[11px] gap-1"
            disabled={generate.isPending}
            onClick={() =>
              generate.mutate({
                tileId: tile.tileId,
                title: tile.title,
                primaryValue: tile.primaryValue,
                secondaryValue: tile.secondaryValue,
                delta: tile.delta,
                severity: tile.severity,
                unit: tile.unit,
                ruleNarrative: tile.narrative,
              })
            }
          >
            {generate.isPending ? (
              <Loader2Icon className="size-3 animate-spin" />
            ) : (
              <SparklesIcon className="size-3" />
            )}
            {aiNarrative ? "Gerar nova análise" : "Gerar insight com IA"}
          </Button>
          {aiNarrative && (
            <button
              type="button"
              onClick={() => setAiNarrative(null)}
              className="text-[10px] text-muted-foreground hover:text-foreground"
            >
              Mostrar análise base
            </button>
          )}
        </div>
        {generate.isError && (
          <p className="text-[10px] text-red-600">
            Falha ao gerar análise. Tente novamente.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
