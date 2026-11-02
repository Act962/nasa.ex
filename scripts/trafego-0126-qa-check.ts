// Conferência das regras puras da spec 0126 (painel enxuto, setup único e criativo pelo Astro).
// Sem runner de testes no projeto (CLAUDE.md, regra 20): cada CA-n vira uma asserção aqui.
// Nenhuma chamada à Meta, à IA ou ao banco.
//
//   pnpm tsx --conditions=react-server scripts/trafego-0126-qa-check.ts

import {
  TRAFEGO_SETUP_BRL_CENTS,
  quoteTrafego,
  resolveTrafegoSetupBrlCents,
} from "../src/features/trafego/lib/pricing-tiers";
import {
  buildCreativeVerdict,
  buildTechnicalOnlyReview,
  checkCreativeTechnical,
} from "../src/features/trafego/lib/creative-review";
import { parseInstagramShortcode, trafegoCreativeDraftSchema } from "../src/features/trafego/lib/creative-review/schema";
import { prescreenAdContent } from "../src/features/trafego/lib/ad-policies";
import { averageAdMetrics, compareWithAverage, deriveAdMetrics, sumAdMetrics } from "../src/features/trafego/lib/order-ads-metrics";
import { ORDER_CLIENT_STATUS_LABEL, isOrderBeforeLaunch } from "../src/features/trafego/lib/order-status";

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

console.log("\nSetup único (CA-4, CA-5, CB-9)");
const firstSetup = resolveTrafegoSetupBrlCents({
  adBudgetBrlCents: 30_000,
  isWhatsappChannel: false,
  needsWhatsappNumber: false,
  hasPaidSetupBefore: false,
});
check("CA-4", "primeira contratação na Meta paga R$ 450", firstSetup, TRAFEGO_SETUP_BRL_CENTS);
check("CA-4", "verba R$ 300 → setup + taxa = R$ 600, sem a verba", quoteTrafego(30_000, firstSetup).totalBrlCents, 60_000);
check(
  "CA-5",
  "empresa que já pagou setup não paga de novo",
  resolveTrafegoSetupBrlCents({ adBudgetBrlCents: 30_000, isWhatsappChannel: false, needsWhatsappNumber: false, hasPaidSetupBefore: true }),
  0,
);
check(
  "CB-9",
  "quem tinha BM e pagou setup zero antes paga agora (hasPaidSetupBefore=false)",
  resolveTrafegoSetupBrlCents({ adBudgetBrlCents: 300_000, isWhatsappChannel: false, needsWhatsappNumber: false, hasPaidSetupBefore: false }),
  45_000,
);
check(
  "RF-8",
  "WhatsApp Oficial continua por faixa (quem já tem número não paga)",
  resolveTrafegoSetupBrlCents({ adBudgetBrlCents: 30_000, isWhatsappChannel: true, needsWhatsappNumber: false, hasPaidSetupBefore: false }),
  0,
);

console.log("\nCriativo: técnico e veredito (CA-6, CA-7, CB-6)");
const lowResItems = checkCreativeTechnical({ kind: "IMAGE", width: 600, height: 600, durationSeconds: null, fileSize: 200_000 });
check("CA-7", "600×600 gera o item de resolução baixa, sem IA", lowResItems.map((item) => item.label), ["Resolução baixa"]);
const personalAttribute = prescreenAdContent({ platform: "META_ADS", texts: ["Você sofre de ansiedade?"] });
check("CA-6", '"Você sofre de ansiedade?" é BLOCKED no prescreen', personalAttribute.level, "BLOCKED");
const riskVerdict = buildCreativeVerdict({
  modelScore: 95,
  items: personalAttribute.hits.map((hit) => ({ group: "policy" as const, level: hit.level, label: hit.label, fix: hit.fix })),
});
check("CA-6", "a IA não rebaixa: veredito vira risco e nota ≤ 40", [riskVerdict.verdict, riskVerdict.score <= 40], ["risk", true]);
check("RF-11", "sem problemas e nota alta = pronto", buildCreativeVerdict({ modelScore: 90, items: [] }).verdict, "ready");
check(
  "CB-6",
  "vídeo sem quadros: análise só técnica, sem quadros lidos",
  buildTechnicalOnlyReview({ kind: "VIDEO", width: null, height: null, durationSeconds: 2, fileSize: 1000 }).framesAnalyzed,
  0,
);

console.log("\nLink do post (CA-8, D-6)");
check("D-6", "link de post do Instagram é aceito", parseInstagramShortcode("https://www.instagram.com/p/C1abc-_9/?igsh=x"), "C1abc-_9");
check("D-6", "reel também", parseInstagramShortcode("https://instagram.com/reel/XYZ123/"), "XYZ123");
check("CA-8", "perfil não é post", parseInstagramShortcode("https://www.instagram.com/orbitahub/"), null);
check("CA-8", "outro site é recusado", parseInstagramShortcode("https://drive.google.com/file/d/abc"), null);
check(
  "RF-9",
  "rascunho precisa de arquivo OU link, nunca os dois",
  trafegoCreativeDraftSchema.safeParse({ kind: "IMAGE", fileKey: "a", postLink: "https://instagram.com/p/x" }).success,
  false,
);

console.log("\nNúmeros por anúncio (CA-2)");
const adOne = { spendCents: 10_000, impressions: 5_000, reach: 4_000, clicks: 100, conversations: 10 };
const adTwo = { spendCents: 5_000, impressions: 5_000, reach: 3_000, clicks: 50, conversations: 0 };
const totals = sumAdMetrics([adOne, adTwo]);
check("CA-2", "o topo soma os anúncios", [totals.spendCents, totals.clicks, totals.conversations], [15_000, 150, 10]);
check("CA-2", "CTR, CPC e CPM derivados das somas", [totals.ctr, totals.cpcCents, totals.cpmCents], [1.5, 100, 1500]);
check("CB-4", "sem entrega não divide por zero", deriveAdMetrics({ spendCents: 0, impressions: 0, reach: 0, clicks: 0, conversations: 0 }).cpmCents, 0);

console.log("\nSetas contra a média dos anúncios");
const averages = averageAdMetrics([adOne, adTwo]);
check("RF-2", "média de investido por anúncio", averages?.spendCents, 7_500);
check("RF-2", "conversas 91% acima da média → seta para cima verde", compareWithAverage("conversations", 7, 3.66)?.tone, "good");
check("RF-2", "custo por conversa acima da média → vermelho", compareWithAverage("costPerConversationCents", 900, 600)?.tone, "bad");
check("RF-2", "custo por conversa abaixo da média → verde", compareWithAverage("costPerConversationCents", 400, 600)?.tone, "good");
check("RF-2", "investido é neutro", compareWithAverage("spendCents", 10_000, averages?.spendCents)?.tone, "neutral");
check("RF-2", "diferença menor que 1% → sem seta", compareWithAverage("spendCents", 7_520, 7_500), null);
check("RF-2", "um anúncio só = a própria média, sem seta", compareWithAverage("ctr", deriveAdMetrics(adOne).ctr, averageAdMetrics([adOne])?.ctr), null);

console.log("\nEstados do cliente (D-3)");
check("D-3", "ONBOARDING vira 'Configurando sua conta'", ORDER_CLIENT_STATUS_LABEL.ONBOARDING, "Configurando sua conta");
check("D-3", "IN_REVIEW vira 'Montando a campanha'", ORDER_CLIENT_STATUS_LABEL.IN_REVIEW, "Montando a campanha");
check("CA-12", "pedido antigo em ONBOARDING mostra o cartão do criativo", isOrderBeforeLaunch("ONBOARDING"), true);
check("CA-12", "no ar não mostra", isOrderBeforeLaunch("RUNNING"), false);

console.log(`\n${passes} ok, ${failures} falha(s)\n`);
process.exit(failures > 0 ? 1 : 0);
