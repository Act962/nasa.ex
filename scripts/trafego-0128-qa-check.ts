// Conferência das regras puras da spec 0128 (nota de qualidade e diagnóstico).
//
//   pnpm tsx --conditions=react-server scripts/trafego-0128-qa-check.ts

import { deriveAdMetrics } from "../src/features/trafego/lib/order-ads-metrics";
import { computeAdsetQuality, computeQualityScore, evaluateAdQuality } from "../src/features/trafego/lib/quality-score";
import { diagnoseIndicator } from "../src/features/trafego/lib/quality-diagnosis";

let passes = 0;
let failures = 0;

function check(caseId: string, description: string, actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    passes++;
    console.log(`  ✓ ${caseId} — ${description}`);
  } else {
    failures++;
    console.log(`  ✗ ${caseId} — ${description}\n      esperado: ${JSON.stringify(expected)}\n      obtido:   ${JSON.stringify(actual)}`);
  }
}

const average = deriveAdMetrics({ spendCents: 10_000, impressions: 10_000, reach: 8_000, clicks: 100, conversations: 10 });
const averageRankings = { quality: "AVERAGE", engagement: "AVERAGE", conversion: "AVERAGE" } as const;
const now = new Date("2026-10-31T12:00:00Z");

console.log("\nNota (CA-1, CA-2, CA-3)");
const onAverage = computeQualityScore({ metrics: average, benchmark: average, rankings: averageRankings });
check("CA-1", "na média e classificações AVERAGE → entre 70 e 85", onAverage >= 70 && onAverage <= 85, true);
const doubleCost = deriveAdMetrics({ spendCents: 20_000, impressions: 20_000, reach: 16_000, clicks: 200, conversations: 10 });
const doubleCostScore = computeQualityScore({ metrics: doubleCost, benchmark: average, rankings: averageRankings });
check("CA-2", "custo por conversa 100% acima → perde o peso dele (≤ 70)", doubleCostScore <= 70, true);
const noConversations = deriveAdMetrics({ spendCents: 10_000, impressions: 10_000, reach: 8_000, clicks: 100, conversations: 0 });
check(
  "CA-3",
  "sem conversas a nota não zera",
  computeQualityScore({ metrics: noConversations, benchmark: average, rankings: averageRankings }) > 50,
  true,
);

console.log("\nPortões de tempo (CA-4, CA-5, CB-3)");
const learning = evaluateAdQuality({
  metrics: average,
  benchmark: average,
  rankings: averageRankings,
  deliveryStatus: "ACTIVE",
  adCreatedAt: "2026-10-20T12:00:00Z",
  adsetLearningStatus: "LEARNING",
  adsetChangedAt: "2026-10-29T12:00:00Z",
  now,
});
check("CA-4", "conjunto aprendendo → avalie a partir de 05/11", learning, { status: "learning", evaluateFrom: "2026-11-05" });
const lowImpressions = evaluateAdQuality({
  metrics: deriveAdMetrics({ spendCents: 1_000, impressions: 600, reach: 500, clicks: 10, conversations: 1 }),
  benchmark: average,
  rankings: averageRankings,
  deliveryStatus: "ACTIVE",
  adCreatedAt: "2026-10-20T12:00:00Z",
  adsetLearningStatus: "SUCCESS",
  adsetChangedAt: null,
  now,
});
check("CA-5", "600 impressões → dados insuficientes", lowImpressions.status, "insufficient");
check(
  "CB-3",
  "reprovado → sem nota",
  evaluateAdQuality({
    metrics: average,
    benchmark: average,
    rankings: averageRankings,
    deliveryStatus: "DISAPPROVED",
    adCreatedAt: null,
    adsetLearningStatus: null,
    adsetChangedAt: null,
    now,
  }).status,
  "problem",
);

console.log("\nConjunto e classificações (RF-4, CB-1, CB-2)");
check(
  "RF-4",
  "nota do conjunto pondera pelo gasto",
  computeAdsetQuality([
    { result: { status: "scored", score: 90, band: "great" }, spendCents: 30_000 },
    { result: { status: "scored", score: 30, band: "weak" }, spendCents: 10_000 },
  ]),
  { status: "scored", score: 75, band: "good" },
);
check(
  "CB-2",
  "classificação UNKNOWN sai da conta",
  computeQualityScore({ metrics: average, benchmark: average, rankings: { quality: "UNKNOWN", engagement: null, conversion: null } }),
  70,
);
check(
  "CB-1",
  "conta com um anúncio só: só as classificações contam",
  computeQualityScore({ metrics: average, benchmark: null, rankings: { quality: "ABOVE_AVERAGE", engagement: "BELOW_AVERAGE_10", conversion: null } }),
  56,
);

console.log("\nTaxa de conversa e diagnóstico (CA-13, RF-7)");
check("CA-13", "57 cliques e 7 conversas → 12,28%", deriveAdMetrics({ spendCents: 1, impressions: 1, reach: 1, clicks: 57, conversations: 7 }).conversationRate, 12.28);
check("RF-7", "CPC acima da média tem diagnóstico", diagnoseIndicator("cpcCents", "up")?.title, "Custo por clique acima da média");

console.log(`\n${passes} ok, ${failures} falha(s)\n`);
process.exit(failures > 0 ? 1 : 0);
