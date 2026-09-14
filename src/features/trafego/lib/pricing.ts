/**
 * Composição de preço do trafeGO: o cliente paga a verba que vai pro anúncio
 * mais a taxa de serviço da NASA (50% por padrão).
 *
 * A soma dos dois inteiros é a fonte de verdade — é exatamente o que vira dois
 * `line_items` no Stripe. Por isso o total nunca é arredondado separadamente.
 */

export interface TrafegoPriceInput {
  adBudgetBrlCents: number;
  /** Percentual da taxa sobre a verba. Ignorado quando há override fixo. */
  serviceFeePercent: number;
  /** Override de taxa fixa em centavos. Quando presente, vence o percentual. */
  serviceFeeBrlCents?: number | null;
}

export interface TrafegoPrice {
  adBudgetBrlCents: number;
  serviceFeeBrlCents: number;
  totalBrlCents: number;
}

/** Mínimo aceito pelo Stripe em BRL. */
export const STRIPE_MIN_BRL_CENTS = 50;

export function computeTrafegoPrice(input: TrafegoPriceInput): TrafegoPrice {
  const adBudgetBrlCents = Math.max(0, Math.round(input.adBudgetBrlCents));

  const serviceFeeBrlCents =
    input.serviceFeeBrlCents != null
      ? Math.max(0, Math.round(input.serviceFeeBrlCents))
      : Math.round((adBudgetBrlCents * input.serviceFeePercent) / 100);

  return {
    adBudgetBrlCents,
    serviceFeeBrlCents,
    totalBrlCents: adBudgetBrlCents + serviceFeeBrlCents,
  };
}

export function formatBrlFromCents(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}
