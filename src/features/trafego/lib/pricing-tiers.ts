/**
 * Faixas de investimento do trafeGO.
 *
 * A taxa de serviço incide SOBRE a verba e vem por cima: quem investe R$ 1.000
 * cai na faixa de 40% e paga R$ 1.400 — os R$ 1.000 inteiros vão para o anúncio.
 *
 * Quanto maior a verba, menor o percentual e menor o setup da conta de anúncios
 * (BM), que zera a partir de R$ 2.501. O setup só é cobrado de quem ainda não
 * tem BM própria, uma única vez.
 */

export interface TrafegoTier {
  id: string;
  minBrlCents: number;
  /** null = sem teto (última faixa). */
  maxBrlCents: number | null;
  feePercent: number;
  setupBrlCents: number;
  label: string;
}

export const MIN_AD_BUDGET_BRL_CENTS = 30_000; // R$ 300,00

/**
 * Teto de verba por campanha: R$ 500.000,00.
 *
 * Existe por dois motivos. O primeiro é aritmético: `Int` do Postgres estoura em
 * R$ 21.474.836,47, e o total (verba + taxa + setup) chega lá antes da verba.
 * O segundo é de negócio — uma compra self-service acima disso deve passar por
 * um gestor, não pelo checkout automático. O simulador direciona para o WhatsApp
 * quando o cliente bate no teto.
 */
export const MAX_AD_BUDGET_BRL_CENTS = 50_000_000; // R$ 500.000,00

export const TRAFEGO_TIERS: TrafegoTier[] = [
  {
    id: "t1",
    minBrlCents: 30_000,
    maxBrlCents: 50_000,
    feePercent: 50,
    setupBrlCents: 50_000,
    label: "R$ 300 a R$ 500",
  },
  {
    id: "t2",
    minBrlCents: 50_100,
    maxBrlCents: 100_000,
    feePercent: 40,
    setupBrlCents: 45_000,
    label: "R$ 501 a R$ 1.000",
  },
  {
    id: "t3",
    minBrlCents: 100_100,
    maxBrlCents: 250_000,
    feePercent: 35,
    setupBrlCents: 40_000,
    label: "R$ 1.001 a R$ 2.500",
  },
  {
    id: "t4",
    minBrlCents: 250_100,
    maxBrlCents: 500_000,
    feePercent: 30,
    setupBrlCents: 0,
    label: "R$ 2.501 a R$ 5.000",
  },
  {
    id: "t5",
    minBrlCents: 500_100,
    maxBrlCents: null,
    feePercent: 25,
    setupBrlCents: 0,
    label: "Acima de R$ 5.000",
  },
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

/** Faixa que atende a verba. Abaixo do mínimo, devolve a primeira. */
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

/** Próxima faixa, para mostrar quanto falta para a taxa cair. */
export function nextTier(current: TrafegoTier): TrafegoTier | null {
  const index = TRAFEGO_TIERS.findIndex((tier) => tier.id === current.id);
  return TRAFEGO_TIERS[index + 1] ?? null;
}

export interface TrafegoQuote {
  adBudgetBrlCents: number;
  tier: TrafegoTier;
  feePercent: number;
  serviceFeeBrlCents: number;
  setupBrlCents: number;
  extraCreativesBrlCents: number;
  totalBrlCents: number;
  /** Quanto falta investir para cair na faixa seguinte; null na última. */
  nextTierGapBrlCents: number | null;
  nextTierFeePercent: number | null;
  /**
   * Quanto o total CAI ao subir para a próxima faixa, já descontando a verba
   * extra. Pode ser positivo mesmo investindo mais: no limite entre faixas,
   * R$ 1 a mais de verba derruba taxa e setup. É o argumento que convence.
   */
  nextTierSavingBrlCents: number | null;
}

/**
 * Simulação completa. `needsSetup` vem da resposta do cliente sobre ter BM —
 * quem já tem conta de anúncios não paga setup.
 */
export function quoteTrafego(
  adBudgetBrlCents: number,
  needsSetup: boolean,
  extraCreatives = 0,
  extraCreativeBrlCents = 0,
): TrafegoQuote {
  const budget = clampAdBudget(adBudgetBrlCents);
  const tier = resolveTier(budget);
  const serviceFeeBrlCents = Math.round((budget * tier.feePercent) / 100);
  const setupBrlCents = needsSetup ? tier.setupBrlCents : 0;
  const upcoming = nextTier(tier);

  const extraCreativesBrlCents =
    Math.max(0, extraCreatives) * Math.max(0, extraCreativeBrlCents);
  const totalBrlCents =
    budget + serviceFeeBrlCents + setupBrlCents + extraCreativesBrlCents;

  let nextTierSavingBrlCents: number | null = null;
  if (upcoming) {
    const upgradedBudget = Math.max(budget, upcoming.minBrlCents);
    const upgradedTotal =
      upgradedBudget +
      Math.round((upgradedBudget * upcoming.feePercent) / 100) +
      (needsSetup ? upcoming.setupBrlCents : 0);
    nextTierSavingBrlCents = totalBrlCents - upgradedTotal;
  }

  return {
    adBudgetBrlCents: budget,
    tier,
    feePercent: tier.feePercent,
    serviceFeeBrlCents,
    setupBrlCents,
    extraCreativesBrlCents,
    totalBrlCents,
    nextTierGapBrlCents: upcoming
      ? Math.max(0, upcoming.minBrlCents - budget)
      : null,
    nextTierFeePercent: upcoming?.feePercent ?? null,
    nextTierSavingBrlCents,
  };
}
