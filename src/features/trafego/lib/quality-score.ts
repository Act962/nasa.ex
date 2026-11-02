// Nota de qualidade 0–100 por anúncio e conjunto (spec 0128, RF-1..RF-6). Regra fixa, sem IA:
// mesmo número, mesma nota. Pesos e faixas aqui, num lugar só, para calibrar com dados reais.

import { compareWithAverage, type AdMetrics } from "./order-ads-metrics";

export type MetaRanking =
  | "ABOVE_AVERAGE"
  | "AVERAGE"
  | "BELOW_AVERAGE_35"
  | "BELOW_AVERAGE_20"
  | "BELOW_AVERAGE_10"
  | "UNKNOWN";

export interface AdRankings {
  quality: MetaRanking | null;
  engagement: MetaRanking | null;
  conversion: MetaRanking | null;
}

type ScoredMetric = "costPerConversationCents" | "ctr" | "cpcCents" | "cpmCents";

const METRIC_WEIGHTS: Record<ScoredMetric, number> = {
  costPerConversationCents: 30,
  ctr: 20,
  cpcCents: 15,
  cpmCents: 10,
};
const RANKING_WEIGHTS: Record<keyof AdRankings, number> = { quality: 10, engagement: 8, conversion: 7 };
const RANKING_SHARE: Partial<Record<MetaRanking, number>> = {
  ABOVE_AVERAGE: 1,
  AVERAGE: 0.7,
  BELOW_AVERAGE_35: 0.3,
  BELOW_AVERAGE_20: 0.15,
  BELOW_AVERAGE_10: 0,
};

export const MIN_IMPRESSIONS_FOR_SCORE = 1000;
export const MIN_DELIVERY_DAYS_FOR_SCORE = 3;
export const LEARNING_WINDOW_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

const PROBLEM_STATUSES = new Set(["DISAPPROVED", "WITH_ISSUES"]);

export type QualityBand = "great" | "good" | "improve" | "weak";

export const QUALITY_BAND_LABEL: Record<QualityBand, string> = {
  great: "Ótimo",
  good: "Bom",
  improve: "Pode melhorar",
  weak: "Fraco",
};

export type QualityResult =
  | { status: "scored"; score: number; band: QualityBand }
  | { status: "learning"; evaluateFrom: string }
  | { status: "insufficient"; evaluateFrom: string }
  | { status: "problem" };

export function resolveQualityBand(score: number): QualityBand {
  if (score >= 80) return "great";
  if (score >= 60) return "good";
  if (score >= 40) return "improve";
  return "weak";
}

/** Na média vale 70% do peso (nota "Bom"); 50%+ melhor vale tudo; 100% pior vale zero. */
const SHARE_AT_AVERAGE = 0.7;
const GAP_FOR_FULL_SHARE = 50;

function metricShare(metric: ScoredMetric, value: number, average: number): number {
  const comparison = compareWithAverage(metric, value, average);
  if (!comparison) return SHARE_AT_AVERAGE;
  if (comparison.tone === "good") {
    return Math.min(1, SHARE_AT_AVERAGE + (1 - SHARE_AT_AVERAGE) * (comparison.percent / GAP_FOR_FULL_SHARE));
  }
  return Math.max(0, SHARE_AT_AVERAGE * (1 - comparison.percent / 100));
}

/** Só a conta da nota, sem os portões de tempo (RF-1, RF-2). */
export function computeQualityScore(params: {
  metrics: AdMetrics;
  benchmark: AdMetrics | null;
  rankings: AdRankings;
}): number {
  let earned = 0;
  let available = 0;

  if (params.benchmark) {
    for (const metric of Object.keys(METRIC_WEIGHTS) as ScoredMetric[]) {
      const average = params.benchmark[metric];
      // Sem conversa não há custo por conversa: o peso sai da conta (CA-3, CB-6).
      if (metric === "costPerConversationCents" && (params.metrics.conversations === 0 || average <= 0)) continue;
      if (average <= 0) continue;
      available += METRIC_WEIGHTS[metric];
      earned += METRIC_WEIGHTS[metric] * metricShare(metric, params.metrics[metric], average);
    }
  }
  for (const ranking of Object.keys(RANKING_WEIGHTS) as (keyof AdRankings)[]) {
    const share = params.rankings[ranking] ? RANKING_SHARE[params.rankings[ranking] as MetaRanking] : undefined;
    if (share === undefined) continue;
    available += RANKING_WEIGHTS[ranking];
    earned += RANKING_WEIGHTS[ranking] * share;
  }
  if (available === 0) return 0;
  return Math.round((earned / available) * 100);
}

function toDateOnly(time: number): string {
  return new Date(time).toISOString().slice(0, 10);
}

/** Nota com os portões: problema na Meta, aprendendo e dados insuficientes (RF-5, RF-6). */
export function evaluateAdQuality(params: {
  metrics: AdMetrics;
  benchmark: AdMetrics | null;
  rankings: AdRankings;
  deliveryStatus: string | null;
  adCreatedAt: string | null;
  adsetLearningStatus: string | null;
  adsetChangedAt: string | null;
  now?: Date;
}): QualityResult {
  const now = (params.now ?? new Date()).getTime();
  if (params.deliveryStatus && PROBLEM_STATUSES.has(params.deliveryStatus)) return { status: "problem" };

  if (params.adsetLearningStatus === "LEARNING") {
    const changedAt = params.adsetChangedAt ? Date.parse(params.adsetChangedAt) : now;
    return { status: "learning", evaluateFrom: toDateOnly(changedAt + LEARNING_WINDOW_DAYS * DAY_MS) };
  }

  const createdAt = params.adCreatedAt ? Date.parse(params.adCreatedAt) : now;
  const deliveryDays = Math.floor((now - createdAt) / DAY_MS);
  if (params.metrics.impressions < MIN_IMPRESSIONS_FOR_SCORE || deliveryDays < MIN_DELIVERY_DAYS_FOR_SCORE) {
    return {
      status: "insufficient",
      evaluateFrom: toDateOnly(Math.max(now + DAY_MS, createdAt + MIN_DELIVERY_DAYS_FOR_SCORE * DAY_MS)),
    };
  }

  const score = computeQualityScore(params);
  return { status: "scored", score, band: resolveQualityBand(score) };
}

/** Nota do conjunto: média das notas dos anúncios, ponderada pelo gasto (RF-4). */
export function computeAdsetQuality(items: { result: QualityResult; spendCents: number }[]): QualityResult | null {
  const scored = items.filter(
    (item): item is { result: Extract<QualityResult, { status: "scored" }>; spendCents: number } =>
      item.result.status === "scored",
  );
  if (scored.length === 0) {
    const learning = items.find((item) => item.result.status === "learning");
    if (learning) return learning.result;
    const insufficient = items.find((item) => item.result.status === "insufficient");
    return insufficient?.result ?? null;
  }
  const totalSpend = scored.reduce((total, item) => total + item.spendCents, 0);
  const score =
    totalSpend > 0
      ? Math.round(scored.reduce((total, item) => total + item.result.score * item.spendCents, 0) / totalSpend)
      : Math.round(scored.reduce((total, item) => total + item.result.score, 0) / scored.length);
  return { status: "scored", score, band: resolveQualityBand(score) };
}
