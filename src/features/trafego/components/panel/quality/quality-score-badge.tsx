"use client";

import { cn } from "@/lib/utils";
import { QUALITY_BAND_LABEL, type QualityResult } from "@/features/trafego/lib/quality-score";

/** Nota de qualidade 0–100 ou o motivo de ainda não ter nota (spec 0128, RF-3, RF-5, RF-6). */

const BAND_STYLE = {
  great: "bg-success/15 text-success",
  good: "bg-success/10 text-success",
  improve: "bg-warning/15 text-warning",
  weak: "bg-destructive/15 text-destructive",
} as const;

function formatDay(isoDate: string): string {
  return isoDate.split("-").reverse().slice(0, 2).join("/");
}

export function QualityScoreBadge({ quality, className }: { quality: QualityResult | null; className?: string }) {
  if (!quality) return null;

  if (quality.status === "scored") {
    return (
      <span
        title={`Nota de qualidade: ${quality.score} de 100`}
        className={cn(
          "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums",
          BAND_STYLE[quality.band],
          className,
        )}
      >
        {quality.score}
        <span className="font-medium">· {QUALITY_BAND_LABEL[quality.band]}</span>
      </span>
    );
  }

  const label =
    quality.status === "learning"
      ? `Aprendendo · avalie a partir de ${formatDay(quality.evaluateFrom)}`
      : quality.status === "insufficient"
        ? `Dados insuficientes · aguarde até ${formatDay(quality.evaluateFrom)}`
        : "Com problema na Meta";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
        quality.status === "problem" ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground",
        className,
      )}
    >
      {label}
    </span>
  );
}
