// Taxa de serviço ÓRBITA por campanha (spec 0040): percentual por faixa sobre
// o custo estimado da Meta, no molde das faixas do trafeGO
// (`src/features/trafego/lib/pricing-tiers.ts`). As faixas vêm do admin
// (`BroadcastFeeSettings`); sem configuração, valem as padrão abaixo.

export interface BroadcastFeeTier {
  /** Custo Meta estimado a partir do qual a faixa vale (centavos). */
  minMetaCostBrlCents: number;
  feePercent: number;
}

export const DEFAULT_BROADCAST_FEE_TIERS: BroadcastFeeTier[] = [
  { minMetaCostBrlCents: 0, feePercent: 50 },
  { minMetaCostBrlCents: 10_001, feePercent: 40 },
  { minMetaCostBrlCents: 50_001, feePercent: 35 },
  { minMetaCostBrlCents: 200_001, feePercent: 30 },
  { minMetaCostBrlCents: 500_001, feePercent: 25 },
];

/** Taxa mínima por campanha: cobre o trabalho mesmo em disparos pequenos. */
export const DEFAULT_MIN_BROADCAST_FEE_BRL_CENTS = 1_990;

export interface BroadcastFeeQuote {
  metaCostBrlCents: number;
  feePercent: number;
  serviceFeeBrlCents: number;
  /** Custo Meta (cartão do cliente na Meta) + taxa ÓRBITA. */
  totalBrlCents: number;
  isMinimumApplied: boolean;
  /** Custo Meta a partir do qual o percentual cai; null na última faixa. */
  nextTierAtBrlCents: number | null;
}

function sortedTiers(tiers: BroadcastFeeTier[]): BroadcastFeeTier[] {
  const valid = tiers.filter((tier) => tier.feePercent >= 0 && tier.minMetaCostBrlCents >= 0);
  return (valid.length ? valid : DEFAULT_BROADCAST_FEE_TIERS).slice().sort((first, second) => first.minMetaCostBrlCents - second.minMetaCostBrlCents);
}

export function quoteBroadcastFee(params: {
  metaCostBrlCents: number;
  tiers?: BroadcastFeeTier[];
  minFeeBrlCents?: number;
}): BroadcastFeeQuote {
  const tiers = sortedTiers(params.tiers ?? DEFAULT_BROADCAST_FEE_TIERS);
  const metaCost = Math.max(0, Math.round(params.metaCostBrlCents));
  const tierIndex = tiers.reduce((found, tier, index) => (metaCost >= tier.minMetaCostBrlCents ? index : found), 0);
  const tier = tiers[tierIndex];
  const percentFee = Math.round((metaCost * tier.feePercent) / 100);
  const minFee = params.minFeeBrlCents ?? DEFAULT_MIN_BROADCAST_FEE_BRL_CENTS;
  const serviceFee = Math.max(percentFee, minFee);
  return {
    metaCostBrlCents: metaCost,
    feePercent: tier.feePercent,
    serviceFeeBrlCents: serviceFee,
    totalBrlCents: metaCost + serviceFee,
    isMinimumApplied: serviceFee > percentFee,
    nextTierAtBrlCents: tiers[tierIndex + 1]?.minMetaCostBrlCents ?? null,
  };
}
