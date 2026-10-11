import { FALLBACK_USD_TO_BRL, getPricing } from "./token-pricing";

// Agrupa os recursos de IA nos quatro usos que a tela "IA da empresa" mostra (spec 0093, RF-10), e
// estima o custo do que rodou na chave da empresa. Puro: conferido por script.

export type AiUseGroup = "attendance" | "calls" | "astro" | "other";

export const AI_USE_GROUPS: { id: AiUseGroup; label: string; unitLabel: string }[] = [
  { id: "attendance", label: "Atendimento ao cliente", unitLabel: "respostas" },
  { id: "calls", label: "Ligações", unitLabel: "usos" },
  { id: "astro", label: "Astro", unitLabel: "pedidos" },
  { id: "other", label: "Automações e demais", unitLabel: "usos" },
];

export function aiUseGroupOf(resourceId: string): AiUseGroup {
  if (resourceId.startsWith("attendance.")) return "attendance";
  if (resourceId.startsWith("calls.")) return "calls";
  if (resourceId.startsWith("astro.")) return "astro";
  return "other";
}

export type AiUsagePeriod = "today" | "7d" | "month";

const SAO_PAULO_OFFSET_MS = 3 * 60 * 60_000;
const DAY_MS = 24 * 60 * 60_000;

/** Início do período, com "hoje" e "este mês" contados no horário de Brasília. */
export function periodStart(period: AiUsagePeriod, now: Date = new Date()): Date {
  if (period === "7d") return new Date(now.getTime() - 7 * DAY_MS);
  const local = new Date(now.getTime() - SAO_PAULO_OFFSET_MS);
  const localStartUtc = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), period === "month" ? 1 : local.getUTCDate());
  return new Date(localStartUtc + SAO_PAULO_OFFSET_MS);
}

/**
 * Custo estimado, em reais, do que rodou na chave da empresa. O registro de uso grava custo zero
 * nesses casos (quem paga o provedor é a empresa), então o valor sai dos tokens e da tabela de preços.
 * `null` = modelo sem preço na tabela (voz por minuto, por exemplo).
 */
export function estimateOwnKeyCostBrl(modelId: string | null, inputTokens: number, outputTokens: number): number | null {
  if (!modelId) return null;
  const pricing = getPricing(modelId);
  if (!pricing || inputTokens + outputTokens === 0) return null;
  return ((inputTokens / 1000) * pricing.inputPer1k + (outputTokens / 1000) * pricing.outputPer1k) * FALLBACK_USD_TO_BRL;
}

/**
 * Custo em reais de um grupo de usos: o gravado no evento quando saiu da chave da plataforma, e a
 * estimativa pelos tokens quando saiu da chave da empresa. `null` = sem preço conhecido.
 */
export function usageCostBrl(usage: { usingCustomKey: boolean; modelId: string | null; inputTokens: number; outputTokens: number; costBrl: number | null }): number | null {
  return usage.usingCustomKey ? estimateOwnKeyCostBrl(usage.modelId, usage.inputTokens, usage.outputTokens) : usage.costBrl;
}

export type AiReportPeriod = "7d" | "30d" | "90d" | "month";

const REPORT_PERIOD_DAYS: Record<Exclude<AiReportPeriod, "month">, number> = { "7d": 7, "30d": 30, "90d": 90 };

export function reportPeriodStart(period: AiReportPeriod, now: Date = new Date()): Date {
  return period === "month" ? periodStart("month", now) : new Date(now.getTime() - REPORT_PERIOD_DAYS[period] * DAY_MS);
}
