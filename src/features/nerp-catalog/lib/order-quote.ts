// Valor do pedido negociado pelo atendente e aprovado pelo cliente (spec 0103). Funções puras.
import type { CatalogOrderItem } from "../schemas/order-payload";

export const CATALOG_INTENT_TAGS = {
  wantsQuote: { slug: "quer-orcamento", name: "Quer orçamento", color: "#f59e0b", description: "Cliente pediu o valor ou quer negociar o pedido do catálogo." },
  wantsToPay: { slug: "quer-pagar", name: "Quer pagar", color: "#10b981", description: "Cliente aprovou o valor e quer pagar o pedido do catálogo." },
} as const;

export type CatalogIntentTagKey = keyof typeof CATALOG_INTENT_TAGS;

export type QuoteState = "no_price" | "awaiting_quote" | "awaiting_approval" | "approved" | "priced";

export type QuoteFields = {
  total: number;
  quoteRequestedAt: Date | string | null;
  quotedAt: Date | string | null;
  quoteApprovedAt: Date | string | null;
};

export function resolveQuoteState(order: QuoteFields): QuoteState {
  if (order.quotedAt) return order.quoteApprovedAt ? "approved" : "awaiting_approval";
  if (order.quoteRequestedAt) return "awaiting_quote";
  return order.total > 0 ? "priced" : "no_price";
}

export const QUOTE_STATE_LABEL: Record<QuoteState, string> = {
  no_price: "Sem valor",
  awaiting_quote: "Aguardando valor do atendente",
  awaiting_approval: "Valor enviado, aguardando aprovação",
  approved: "Valor aprovado",
  priced: "Com valor do catálogo",
};

const NO_PRICE_REASON = "Pedido sem valor: o atendente precisa enviar o valor negociado antes da cobrança.";

const CHARGE_BLOCK_REASON: Partial<Record<QuoteState, string>> = {
  no_price: NO_PRICE_REASON,
  awaiting_quote: "Pedido aguardando o valor do atendente: a cobrança só sai depois do valor enviado e aprovado.",
  awaiting_approval: "Valor enviado e aguardando aprovação do cliente: a cobrança só sai depois que ele aprovar.",
};

/** `null` = pode cobrar. Ponto único usado pelo Astro e pelo portal (spec 0103, RF-5). */
export function getChargeBlockReason(order: QuoteFields): string | null {
  const state = resolveQuoteState(order);
  if (order.total <= 0) return CHARGE_BLOCK_REASON[state] ?? NO_PRICE_REASON;
  return CHARGE_BLOCK_REASON[state] ?? null;
}

const toCents = (value: number) => Math.round(value * 100);
const fromCents = (cents: number) => cents / 100;

export type QuoteInput = { unitPrices: number[]; shipping: number; discount: number };

export type QuotedTotals = { items: CatalogOrderItem[]; subtotal: number; shipping: number; discount: number; total: number };

export class InvalidQuoteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidQuoteError";
  }
}

/** Recalcula itens e totais em centavos para não acumular erro de ponto flutuante. */
export function computeQuotedTotals(items: CatalogOrderItem[], input: QuoteInput): QuotedTotals {
  if (input.unitPrices.length !== items.length) {
    throw new InvalidQuoteError("Informe o preço de todos os itens do pedido.");
  }
  if ([...input.unitPrices, input.shipping, input.discount].some((value) => !Number.isFinite(value) || value < 0)) {
    throw new InvalidQuoteError("Valores não podem ser negativos.");
  }
  const quotedItems = items.map((item, index) => {
    const unitPrice = fromCents(toCents(input.unitPrices[index]));
    return { ...item, unitPrice, total: fromCents(Math.round(item.quantity * toCents(unitPrice))) };
  });
  const subtotalCents = quotedItems.reduce((sum, item) => sum + toCents(item.total), 0);
  const totalCents = subtotalCents + toCents(input.shipping) - toCents(input.discount);
  if (totalCents <= 0) throw new InvalidQuoteError("O total do pedido precisa ser maior que zero.");
  return {
    items: quotedItems,
    subtotal: fromCents(subtotalCents),
    shipping: fromCents(toCents(input.shipping)),
    discount: fromCents(toCents(input.discount)),
    total: fromCents(totalCents),
  };
}
