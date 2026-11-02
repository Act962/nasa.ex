"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { compareWithAverage, type AdMetrics } from "@/features/trafego/lib/order-ads-metrics";

/** Seta contra a média da conta: direção = acima/abaixo; cor = bom (verde) ou ruim (vermelho) para o cliente. */
export function AverageArrow({
  metric,
  value,
  average,
  className,
}: {
  metric: keyof AdMetrics;
  value: number;
  average: number | null | undefined;
  className?: string;
}) {
  const comparison = compareWithAverage(metric, value, average);
  if (!comparison) return null;
  const Icon = comparison.direction === "up" ? ArrowUp : ArrowDown;
  return (
    <span
      title={`${comparison.percent}% ${comparison.direction === "up" ? "acima" : "abaixo"} da média dos anúncios da conta`}
      className={cn(
        "inline-flex items-center",
        comparison.tone === "good" && "text-success",
        comparison.tone === "bad" && "text-destructive",
        comparison.tone === "neutral" && "text-muted-foreground",
        className,
      )}
    >
      <Icon className="size-3.5" />
    </span>
  );
}
