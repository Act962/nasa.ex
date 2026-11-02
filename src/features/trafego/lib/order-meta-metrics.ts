import { extractOrderCodes } from "./campaign-code";

/** Regras puras do Desempenho pela conta do cliente (spec 0122, RF-12/RF-13). Sem rede: o script de QA testa direto. */

export const PERFORMANCE_RANGES = ["order", "last_7d", "last_30d"] as const;
export type PerformanceRange = (typeof PERFORMANCE_RANGES)[number];

export const PERFORMANCE_BREAKDOWNS = ["age", "gender", "publisher_platform"] as const;
export type PerformanceBreakdown = (typeof PERFORMANCE_BREAKDOWNS)[number];

const DAY_MS = 24 * 60 * 60 * 1000;

/** Data `AAAA-MM-DD` no fuso da conta de anúncios (CB-4). */
export function formatDateInTimeZone(date: Date, timeZone: string | null): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timeZone ?? "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

export function resolvePerformancePeriod(params: {
  range: PerformanceRange;
  orderStartedAt: Date | null;
  orderCreatedAt: Date;
  timeZone: string | null;
  now?: Date;
}): { since: string; until: string } {
  const now = params.now ?? new Date();
  const until = formatDateInTimeZone(now, params.timeZone);
  if (params.range === "order") {
    const orderStart = params.orderStartedAt ?? params.orderCreatedAt;
    const since = formatDateInTimeZone(orderStart, params.timeZone);
    return { since: since > until ? until : since, until };
  }
  const daysBack = params.range === "last_7d" ? 6 : 29;
  return { since: formatDateInTimeZone(new Date(now.getTime() - daysBack * DAY_MS), params.timeZone), until };
}

/** Campanha do pedido: o código exato no nome (`TG-0002` ≠ `TG-00021`) ou o id vinculado (CA-2). */
export function isOrderCampaign(params: {
  campaignId: string | null | undefined;
  campaignName: string | null | undefined;
  orderCode: string;
  linkedCampaignId: string | null | undefined;
}): boolean {
  if (params.linkedCampaignId && params.campaignId === params.linkedCampaignId) return true;
  if (!params.campaignName) return false;
  return extractOrderCodes(params.campaignName).includes(params.orderCode.toUpperCase());
}

export function toCents(amountInAccountCurrency: number): number {
  return Math.round(amountInAccountCurrency * 100);
}

export interface OrderBudgetUsage {
  adBudgetBrlCents: number;
  spentBrlCents: number;
  remainingBrlCents: number;
  /** `null` quando a conta não é em BRL: não dá para comparar com a verba (CA-7). */
  percentUsed: number | null;
  currency: string;
}

export function buildOrderBudgetUsage(params: {
  adBudgetBrlCents: number;
  spentCents: number;
  currency: string;
}): OrderBudgetUsage {
  const isBrl = params.currency.toUpperCase() === "BRL";
  const percentUsed =
    isBrl && params.adBudgetBrlCents > 0
      ? Math.min(100, Math.round((params.spentCents / params.adBudgetBrlCents) * 1000) / 10)
      : isBrl
        ? 0
        : null;
  return {
    adBudgetBrlCents: params.adBudgetBrlCents,
    spentBrlCents: params.spentCents,
    remainingBrlCents: isBrl ? Math.max(0, params.adBudgetBrlCents - params.spentCents) : 0,
    percentUsed,
    currency: params.currency,
  };
}

export type AccountKpiFormat = "int" | "currency" | "pct" | "decimal";

export interface AccountKpi {
  key: string;
  label: string;
  value: number;
  format: AccountKpiFormat;
}

/** KPIs na ordem em que o Gerenciador de Anúncios costuma mostrar para quem anuncia para WhatsApp. */
export function buildAccountKpis(totals: {
  spend: number;
  messagingConversations: number;
  costPerMessagingConversation: number;
  reach: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpm: number;
  frequency: number;
}): AccountKpi[] {
  return [
    { key: "spend", label: "Investido", value: toCents(totals.spend), format: "currency" },
    { key: "conversations", label: "Conversas iniciadas", value: totals.messagingConversations, format: "int" },
    {
      key: "costPerConversation",
      label: "Custo por conversa",
      value: toCents(totals.costPerMessagingConversation),
      format: "currency",
    },
    { key: "reach", label: "Alcance", value: totals.reach, format: "int" },
    { key: "impressions", label: "Impressões", value: totals.impressions, format: "int" },
    { key: "clicks", label: "Cliques", value: totals.clicks, format: "int" },
    { key: "ctr", label: "CTR", value: totals.ctr, format: "pct" },
    { key: "cpm", label: "CPM", value: toCents(totals.cpm), format: "currency" },
    { key: "frequency", label: "Frequência", value: totals.frequency, format: "decimal" },
  ];
}
