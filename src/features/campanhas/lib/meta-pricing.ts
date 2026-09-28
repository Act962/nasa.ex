// Custo estimado das mensagens na Meta (spec 0040). Puro: tela e servidor.
// A Meta não publica preço por API; os valores são referência do Brasil e se
// ajustam por env (`META_PRICE_*_USD`, `META_USD_BRL_RATE`).

export type TemplateCategory = "MARKETING" | "UTILITY" | "AUTHENTICATION";

export const TEMPLATE_CATEGORY_LABELS: Record<TemplateCategory, string> = {
  MARKETING: "Marketing",
  UTILITY: "Utilidade",
  AUTHENTICATION: "Autenticação",
};

/** Referência Brasil 2026, em dólar por mensagem entregue. */
const DEFAULT_PRICE_USD: Record<TemplateCategory, number> = {
  MARKETING: 0.0625,
  UTILITY: 0.0068,
  AUTHENTICATION: 0.0068,
};
const DEFAULT_USD_BRL_RATE = 5.4;

/** Até esta data, Utilidade dentro da janela de 24h aberta é grátis. */
export const UTILITY_IN_WINDOW_FREE_UNTIL = new Date("2026-10-01T03:00:00.000Z");

function readNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export interface MetaPriceTable {
  usdBrlRate: number;
  priceUsd: Record<TemplateCategory, number>;
}

export function metaPriceTable(env: Record<string, string | undefined> = {}): MetaPriceTable {
  return {
    usdBrlRate: readNumber(env.META_USD_BRL_RATE, DEFAULT_USD_BRL_RATE),
    priceUsd: {
      MARKETING: readNumber(env.META_PRICE_MARKETING_USD, DEFAULT_PRICE_USD.MARKETING),
      UTILITY: readNumber(env.META_PRICE_UTILITY_USD, DEFAULT_PRICE_USD.UTILITY),
      AUTHENTICATION: readNumber(env.META_PRICE_AUTHENTICATION_USD, DEFAULT_PRICE_USD.AUTHENTICATION),
    },
  };
}

export interface MetaCostEstimate {
  category: TemplateCategory;
  /** Destinatários que pagam (fora da janela, ou todos se a categoria não tem isenção). */
  chargedRecipients: number;
  pricePerMessageBrlCents: number;
  totalBrlCents: number;
}

/**
 * Estimativa do que a Meta cobra no cartão do cliente. `openWindowRecipients`
 * são os que falaram com a empresa nas últimas 24h: Utilidade para eles é
 * grátis até 01/10/2026.
 */
export function estimateMetaCost(params: {
  recipients: number;
  category: TemplateCategory;
  openWindowRecipients?: number;
  now?: Date;
  table?: MetaPriceTable;
}): MetaCostEstimate {
  const table = params.table ?? metaPriceTable();
  const now = params.now ?? new Date();
  const recipients = Math.max(0, Math.round(params.recipients));
  const openWindow = Math.min(recipients, Math.max(0, Math.round(params.openWindowRecipients ?? 0)));
  const isWindowFree = params.category === "UTILITY" && now < UTILITY_IN_WINDOW_FREE_UNTIL;
  const chargedRecipients = isWindowFree ? recipients - openWindow : recipients;
  const pricePerMessageBrlCents = table.priceUsd[params.category] * table.usdBrlRate * 100;
  return {
    category: params.category,
    chargedRecipients,
    pricePerMessageBrlCents,
    totalBrlCents: Math.round(chargedRecipients * pricePerMessageBrlCents),
  };
}

export function formatBrlCents(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
