// Linha do tempo do acompanhamento na venda guiada (spec 0104, RF-22): segue o que acontece no WhatsApp,
// não a coluna do lead (que fica em "Novo Pedido" até o pagamento). Função pura.
import type { CatalogStageKey } from "./catalog-stages";
import { CATALOG_STAGE_KEYS } from "./catalog-stages";
import type { QuoteState } from "./order-quote";

export const GUIDED_TIMELINE_STEPS = [
  "Pedido recebido",
  "Preparando o valor",
  "Valor enviado",
  "Pagamento",
  "Conferindo o pedido",
  "Separação",
  "Em rota",
  "Entregue",
] as const;

const STEP = {
  preparing: 1,
  quoteSent: 2,
  payment: 3,
  checking: 4,
  separation: 5,
  onRoute: 6,
  delivered: 7,
} as const;

const PAID_STATUSES = new Set(["PAID", "IN_LOGISTICS"]);

/** Índice (0-based) da etapa atual; as anteriores estão feitas. */
export function resolveGuidedTimelineStep(input: {
  status: string;
  quoteState: QuoteState;
  stageKey: CatalogStageKey | null;
  isPostPaymentApproved: boolean;
}): number {
  if (input.status === "DELIVERED" || input.stageKey === CATALOG_STAGE_KEYS.delivered) return STEP.delivered;
  if (input.stageKey === CATALOG_STAGE_KEYS.onRoute) return STEP.onRoute;
  if (input.stageKey === CATALOG_STAGE_KEYS.separated) return STEP.separation;
  if (PAID_STATUSES.has(input.status)) return input.isPostPaymentApproved ? STEP.separation : STEP.checking;
  if (input.status === "AWAITING_PAYMENT" || input.quoteState === "approved") return STEP.payment;
  if (input.quoteState === "awaiting_approval") return STEP.quoteSent;
  return STEP.preparing;
}

/** Texto de apoio da etapa atual, no tom das mensagens do WhatsApp. */
export function guidedTimelineHint(step: number, deliveryForecast: string | null): string | null {
  if (step === STEP.preparing) return "A equipe está conferindo estoque e preço.";
  if (step === STEP.quoteSent) return "Confira o valor no WhatsApp e responda se fecha.";
  if (step === STEP.payment) return "Falta só o pagamento.";
  if (step === STEP.checking) return "Pagamento recebido, estamos conferindo o pedido.";
  if ((step === STEP.separation || step === STEP.onRoute) && deliveryForecast) return `Entrega prevista: ${deliveryForecast}`;
  return null;
}
