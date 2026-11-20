// Números por anúncio da visão da campanha (spec 0126, RF-2). Puro: roda no QA sem Meta.

export interface AdMetrics {
  spendCents: number;
  impressions: number;
  reach: number;
  clicks: number;
  conversations: number;
  /** Percentual, ex.: 1.8 = 1,8%. */
  ctr: number;
  cpcCents: number;
  cpmCents: number;
  costPerConversationCents: number;
  frequency: number;
  /** Conversas ÷ cliques, em %: de quem clicou, quantos mandaram mensagem (spec 0128, RF-15). */
  conversationRate: number;
}

export interface AdMetricsInput {
  spendCents: number;
  impressions: number;
  reach: number;
  clicks: number;
  conversations: number;
}

function safeDivide(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
}

/** Taxas derivadas das somas, para o topo bater com os anúncios (CA-2). */
export function deriveAdMetrics(input: AdMetricsInput): AdMetrics {
  return {
    ...input,
    ctr: Math.round(safeDivide(input.clicks, input.impressions) * 10_000) / 100,
    cpcCents: Math.round(safeDivide(input.spendCents, input.clicks)),
    cpmCents: Math.round(safeDivide(input.spendCents, input.impressions) * 1000),
    costPerConversationCents: Math.round(safeDivide(input.spendCents, input.conversations)),
    frequency: Math.round(safeDivide(input.impressions, input.reach) * 100) / 100,
    conversationRate: Math.round(safeDivide(input.conversations, input.clicks) * 10_000) / 100,
  };
}

/** O alcance somado conta duas vezes quem viu dois anúncios: é um teto, e a tela diz isso. */
export function sumAdMetrics(items: AdMetricsInput[]): AdMetrics {
  return deriveAdMetrics(
    items.reduce<AdMetricsInput>(
      (total, item) => ({
        spendCents: total.spendCents + item.spendCents,
        impressions: total.impressions + item.impressions,
        reach: total.reach + item.reach,
        clicks: total.clicks + item.clicks,
        conversations: total.conversations + item.conversations,
      }),
      { spendCents: 0, impressions: 0, reach: 0, clicks: 0, conversations: 0 },
    ),
  );
}

/** Média por anúncio: soma dividida pelo número de anúncios; taxas vêm das somas (ponderadas). */
export function averageAdMetrics(items: AdMetricsInput[]): AdMetrics | null {
  if (items.length === 0) return null;
  const totals = sumAdMetrics(items);
  return {
    ...totals,
    spendCents: Math.round(totals.spendCents / items.length),
    impressions: Math.round(totals.impressions / items.length),
    reach: Math.round(totals.reach / items.length),
    clicks: Math.round(totals.clicks / items.length),
    conversations: Math.round((totals.conversations / items.length) * 100) / 100,
  };
}

const MIN_AVERAGE_GAP = 0.01;

/** Mais é melhor para resultado, menos é melhor para custo; investido e frequência não são bons nem ruins. */
const METRIC_POLARITY: Partial<Record<keyof AdMetrics, "higher_is_better" | "lower_is_better">> = {
  conversations: "higher_is_better",
  clicks: "higher_is_better",
  ctr: "higher_is_better",
  reach: "higher_is_better",
  impressions: "higher_is_better",
  conversationRate: "higher_is_better",
  costPerConversationCents: "lower_is_better",
  cpcCents: "lower_is_better",
  cpmCents: "lower_is_better",
};

export type AverageTone = "good" | "bad" | "neutral";

/**
 * Seta contra a média: a direção diz acima/abaixo; a cor diz se isso é bom (verde) ou
 * ruim (vermelho) para o cliente — conversas acima da média é verde, custo acima é vermelho.
 * Null sem base ou diferença menor que 1%.
 */
export function compareWithAverage(
  metric: keyof AdMetrics,
  value: number,
  average: number | null | undefined,
): { direction: "up" | "down"; tone: AverageTone; percent: number } | null {
  if (average === null || average === undefined || average <= 0) return null;
  // Custo zero é falta de entrega (sem conversa, clique ou impressão), não custo baixo.
  if (METRIC_POLARITY[metric] === "lower_is_better" && value <= 0) return null;
  const gap = (value - average) / average;
  if (Math.abs(gap) < MIN_AVERAGE_GAP) return null;
  const direction = gap > 0 ? "up" : "down";
  const polarity = METRIC_POLARITY[metric];
  const tone: AverageTone = !polarity
    ? "neutral"
    : (polarity === "higher_is_better") === (direction === "up")
      ? "good"
      : "bad";
  return { direction, tone, percent: Math.round(Math.abs(gap) * 100) };
}
