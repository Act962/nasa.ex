/**
 * Preço do trafeGO (spec 0123).
 *
 * A verba de tráfego é paga pelo cliente direto à Meta, no meio de pagamento da
 * conta dele: a Órbita cobra só o serviço. A taxa é 30% da verba declarada, com
 * mínimo de R$ 150 por pedido. Se o gasto real passar da verba declarada, a
 * diferença gera complemento de 30% (ver `complement.ts`).
 *
 * Setup (spec 0126): R$ 450 pela configuração inicial da equipe (conectar a conta
 * Meta nos Satélites), cobrado uma única vez por empresa. As faixas abaixo valem
 * só para o setup do número no WhatsApp Oficial.
 */

export interface TrafegoTier {
  id: string;
  minBrlCents: number;
  /** null = sem teto (última faixa). */
  maxBrlCents: number | null;
  setupBrlCents: number;
  label: string;
}

export const TRAFEGO_SERVICE_FEE_PERCENT = 30;
export const TRAFEGO_MIN_SERVICE_FEE_BRL_CENTS = 15_000; // R$ 150,00

export const MIN_AD_BUDGET_BRL_CENTS = 30_000; // R$ 300,00

export const TRAFEGO_SETUP_BRL_CENTS = 45_000; // R$ 450,00

/**
 * Teto de verba por campanha: R$ 500.000,00. Uma compra self-service acima
 * disso deve passar por um gestor; o simulador direciona para o WhatsApp.
 */
export const MAX_AD_BUDGET_BRL_CENTS = 50_000_000; // R$ 500.000,00

export const TRAFEGO_TIERS: TrafegoTier[] = [
  { id: "t1", minBrlCents: 30_000, maxBrlCents: 50_000, setupBrlCents: 50_000, label: "R$ 300 a R$ 500" },
  { id: "t2", minBrlCents: 50_100, maxBrlCents: 100_000, setupBrlCents: 45_000, label: "R$ 501 a R$ 1.000" },
  { id: "t3", minBrlCents: 100_100, maxBrlCents: 250_000, setupBrlCents: 40_000, label: "R$ 1.001 a R$ 2.500" },
  { id: "t4", minBrlCents: 250_100, maxBrlCents: 500_000, setupBrlCents: 0, label: "R$ 2.501 a R$ 5.000" },
  { id: "t5", minBrlCents: 500_100, maxBrlCents: null, setupBrlCents: 0, label: "Acima de R$ 5.000" },
];

/** Prende a verba entre o piso e o teto — a fonte única desses limites. */
export function clampAdBudget(adBudgetBrlCents: number): number {
  const rounded = Math.round(adBudgetBrlCents);
  if (!Number.isFinite(rounded)) return MIN_AD_BUDGET_BRL_CENTS;
  return Math.min(
    MAX_AD_BUDGET_BRL_CENTS,
    Math.max(MIN_AD_BUDGET_BRL_CENTS, rounded),
  );
}

/** Faixa de setup do WhatsApp Oficial que atende a verba. Abaixo do mínimo, devolve a primeira. */
export function resolveTier(adBudgetBrlCents: number): TrafegoTier {
  const budget = clampAdBudget(adBudgetBrlCents);
  return (
    TRAFEGO_TIERS.find(
      (tier) =>
        budget >= tier.minBrlCents &&
        (tier.maxBrlCents === null || budget <= tier.maxBrlCents),
    ) ??
    // Entre o teto de uma faixa e o piso da seguinte (ex.: R$ 500,50), assume a
    // faixa mais vantajosa para o cliente.
    TRAFEGO_TIERS.reduce((best, tier) =>
      budget >= tier.minBrlCents ? tier : best,
    )
  );
}

/** Taxa de serviço sobre uma verba (ou um gasto real): 30%, nunca abaixo do mínimo. */
export function computeTrafegoServiceFee(adBudgetBrlCents: number): number {
  return Math.max(
    TRAFEGO_MIN_SERVICE_FEE_BRL_CENTS,
    Math.round((Math.max(0, adBudgetBrlCents) * TRAFEGO_SERVICE_FEE_PERCENT) / 100),
  );
}

export interface TrafegoQuote {
  /** Verba declarada — paga pelo cliente à Meta; só entra no cálculo da taxa. */
  adBudgetBrlCents: number;
  tier: TrafegoTier;
  feePercent: number;
  /** A taxa ficou no mínimo de R$ 150. */
  isMinimumFee: boolean;
  serviceFeeBrlCents: number;
  setupBrlCents: number;
  extraCreativesBrlCents: number;
  /** O que a Órbita cobra agora: serviço + setup + criativos extras (sem a verba). */
  totalBrlCents: number;
}

/**
 * Setup da contratação (spec 0126, RF-8). Nos canais da Meta é fixo e cobrado uma
 * vez por empresa; no WhatsApp Oficial continua por faixa, só para quem não tem número.
 */
export function resolveTrafegoSetupBrlCents(params: {
  adBudgetBrlCents: number;
  isWhatsappChannel: boolean;
  needsWhatsappNumber: boolean;
  hasPaidSetupBefore: boolean;
}): number {
  if (params.isWhatsappChannel) {
    return params.needsWhatsappNumber ? resolveTier(params.adBudgetBrlCents).setupBrlCents : 0;
  }
  return params.hasPaidSetupBefore ? 0 : TRAFEGO_SETUP_BRL_CENTS;
}

/** Simulação completa. O setup vem de `resolveTrafegoSetupBrlCents`. */
export function quoteTrafego(
  adBudgetBrlCents: number,
  setupBrlCents: number,
  extraCreatives = 0,
  extraCreativeBrlCents = 0,
): TrafegoQuote {
  const budget = clampAdBudget(adBudgetBrlCents);
  const tier = resolveTier(budget);
  const serviceFeeBrlCents = computeTrafegoServiceFee(budget);
  const safeSetupBrlCents = Math.max(0, Math.round(setupBrlCents));
  const extraCreativesBrlCents =
    Math.max(0, extraCreatives) * Math.max(0, extraCreativeBrlCents);

  return {
    adBudgetBrlCents: budget,
    tier,
    feePercent: TRAFEGO_SERVICE_FEE_PERCENT,
    isMinimumFee: serviceFeeBrlCents === TRAFEGO_MIN_SERVICE_FEE_BRL_CENTS,
    serviceFeeBrlCents,
    setupBrlCents: safeSetupBrlCents,
    extraCreativesBrlCents,
    totalBrlCents: serviceFeeBrlCents + safeSetupBrlCents + extraCreativesBrlCents,
  };
}

export interface TrafegoPriceParts {
  serviceFeeBrlCents: number;
  setupBrlCents: number;
  extraCreativesBrlCents: number;
  adBudgetBrlCents: number;
}

export interface TrafegoDiscountAllocation extends TrafegoPriceParts {
  /** Desconto efetivamente aplicado — nunca passa do total. */
  discountBrlCents: number;
  /** O cupom chegou na verba: muda a entrega, a equipe precisa saber. */
  touchesAdBudget: boolean;
}

/**
 * Distribui o desconto de um cupom pelas parcelas (spec 0010 §5.1): taxa →
 * setup → criativos extras → verba. A verba é a última porque desconto nela é
 * menos dinheiro no anúncio, não menos margem.
 */
export function allocateTrafegoDiscount(
  parts: TrafegoPriceParts,
  discountBrlCents: number,
): TrafegoDiscountAllocation {
  let remaining = Math.max(0, discountBrlCents);
  const takeFrom = (value: number) => {
    const taken = Math.min(value, remaining);
    remaining -= taken;
    return value - taken;
  };

  const serviceFeeBrlCents = takeFrom(parts.serviceFeeBrlCents);
  const setupBrlCents = takeFrom(parts.setupBrlCents);
  const extraCreativesBrlCents = takeFrom(parts.extraCreativesBrlCents);
  const adBudgetBrlCents = takeFrom(parts.adBudgetBrlCents);

  return {
    serviceFeeBrlCents,
    setupBrlCents,
    extraCreativesBrlCents,
    adBudgetBrlCents,
    discountBrlCents: Math.max(0, discountBrlCents) - remaining,
    touchesAdBudget: adBudgetBrlCents < parts.adBudgetBrlCents,
  };
}
