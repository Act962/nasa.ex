import type { LeadMetricsView } from "./metric-format";

// Temperatura calculada do lead (0–100%): quão "vivo" está o relacionamento
// agora — recência, volume, chegada recente e como a equipe está atendendo.
// Diferente do potencial de compra, que mede a chance de fechar negócio.

export type HeatLevel = "COLD" | "WARM" | "HOT" | "VERY_HOT";

const DAY_MS = 24 * 60 * 60_000;

export const HEAT_LEVELS: Record<HeatLevel, { label: string; color: string }> = {
  COLD: { label: "Frio", color: "#38bdf8" },
  WARM: { label: "Morno", color: "#fbbf24" },
  HOT: { label: "Quente", color: "#f97316" },
  VERY_HOT: { label: "Quentíssimo", color: "#ef4444" },
};

function daysSince(value: Date | string | null | undefined, now: Date): number | null {
  if (!value) return null;
  return (now.getTime() - new Date(value).getTime()) / DAY_MS;
}

function recencyPoints(days: number | null): number {
  if (days === null) return 0;
  if (days <= 1) return 25;
  if (days <= 3) return 18;
  if (days <= 7) return 10;
  if (days <= 30) return 4;
  return 0;
}

function warmingPoints(daysSinceArrival: number | null): number {
  if (daysSinceArrival === null) return 0;
  if (daysSinceArrival <= 2) return 15;
  if (daysSinceArrival <= 7) return 10;
  if (daysSinceArrival <= 30) return 5;
  return 0;
}

function responsePoints(seconds: number | null): number {
  if (seconds === null) return 0;
  if (seconds <= 5 * 60) return 15;
  if (seconds <= 30 * 60) return 10;
  if (seconds <= 2 * 60 * 60) return 5;
  return 0;
}

export function computeLeadHeat(params: {
  metrics: LeadMetricsView;
  createdAt: Date | string;
  lastInboundAt: Date | string | null;
  now?: Date;
}): { score: number; level: HeatLevel } {
  const now = params.now ?? new Date();
  const { metrics } = params;
  const score = Math.round(
    recencyPoints(daysSince(params.lastInboundAt, now)) +
      Math.min(20, metrics.interactionsPerMonth) +
      warmingPoints(daysSince(params.createdAt, now)) +
      responsePoints(metrics.avgResponseSeconds) +
      ((metrics.qualityScore ?? 0) / 100) * 15 +
      ((metrics.resolutionRate ?? 0) / 100) * 10,
  );
  const clamped = Math.max(0, Math.min(100, score));
  const level: HeatLevel = clamped >= 75 ? "VERY_HOT" : clamped >= 50 ? "HOT" : clamped >= 25 ? "WARM" : "COLD";
  return { score: clamped, level };
}
