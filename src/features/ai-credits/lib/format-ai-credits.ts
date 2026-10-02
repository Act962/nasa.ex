import type { AiCreditLevel } from "./ai-credit-types";

/** Formatação compartilhada das telas de créditos de IA. */

export function formatUsd(amountUsd: number | null | undefined, fractionDigits = 2): string {
  if (amountUsd === null || amountUsd === undefined || !Number.isFinite(amountUsd)) return "—";
  return amountUsd.toLocaleString("pt-BR", { style: "currency", currency: "USD", minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits });
}

export function formatTokens(tokens: number | null | undefined): string {
  if (tokens === null || tokens === undefined || !Number.isFinite(tokens)) return "—";
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return tokens.toLocaleString("pt-BR");
}

export function formatDaysLeft(daysLeft: number | null | undefined): string {
  if (daysLeft === null || daysLeft === undefined || !Number.isFinite(daysLeft)) return "—";
  if (daysLeft < 1) return "menos de 1 dia";
  const wholeDays = Math.floor(daysLeft);
  return `${wholeDays} dia${wholeDays === 1 ? "" : "s"}`;
}

export const AI_CREDIT_LEVEL_LABELS: Record<AiCreditLevel, string> = {
  unknown: "Saldo não informado",
  free: "Nível gratuito",
  ok: "Saldo saudável",
  warning: "Saldo baixando",
  critical: "Quase no fim",
};

export const AI_CREDIT_LEVEL_BADGE_CLASSES: Record<AiCreditLevel, string> = {
  unknown: "bg-muted text-muted-foreground border-border",
  free: "bg-info/15 text-info border-info/30",
  ok: "bg-success/15 text-success border-success/30",
  warning: "bg-warning/15 text-warning border-warning/30",
  critical: "bg-destructive/15 text-destructive border-destructive/30",
};
