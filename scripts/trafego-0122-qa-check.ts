// Conferência das regras puras da spec 0122 (base Meta, Desempenho e "Corrigir valores").
// Não há runner de testes no projeto (CLAUDE.md, regra 20): cada CA-n vira uma asserção aqui.
// Nenhuma chamada de rede.
//
//   pnpm tsx scripts/trafego-0122-qa-check.ts

import {
  buildMetaGraphUrl,
  classifyMetaError,
  readRetryAfterMinutes,
} from "../src/http/meta/graph-client";
import {
  buildOrderBudgetUsage,
  isOrderCampaign,
  resolvePerformancePeriod,
} from "../src/features/trafego/lib/order-meta-metrics";
import {
  buildTrafegoPlanName,
  planFinanceCorrection,
  planOrderValuesCorrection,
} from "../src/features/trafego/lib/order-values";

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

console.log("\nCampanhas do pedido (CA-2)");
const orderCampaign = (campaignName: string, campaignId = "999") =>
  isOrderCampaign({ campaignId, campaignName, orderCode: "TG-0002", linkedCampaignId: "123" });
check("CA-2", "nome com TG-0002 conta", orderCampaign("TG-0002 — Clínica — Mensagens"), true);
check("CA-2", "TG-00021 não conta como TG-0002", orderCampaign("TG-00021 — Outra"), false);
check("CA-2", "campanha sem código não conta", orderCampaign("Campanha antiga da clínica"), false);
check("CA-2", "campanha vinculada conta mesmo sem o código", orderCampaign("Renomeada", "123"), true);

console.log("\nPeríodo e cache (CA-6, CB-4)");
const now = new Date("2026-10-30T02:30:00Z");
check(
  "CB-4",
  "data de hoje no fuso de São Paulo (ainda dia 29)",
  resolvePerformancePeriod({ range: "last_7d", orderStartedAt: null, orderCreatedAt: now, timeZone: "America/Sao_Paulo", now }),
  { since: "2026-10-23", until: "2026-10-29" },
);
check(
  "CA-6",
  "períodos diferentes geram intervalos diferentes",
  JSON.stringify(resolvePerformancePeriod({ range: "last_7d", orderStartedAt: null, orderCreatedAt: now, timeZone: null, now })) !==
    JSON.stringify(resolvePerformancePeriod({ range: "last_30d", orderStartedAt: null, orderCreatedAt: now, timeZone: null, now })),
  true,
);

console.log("\nVerba usada (CA-7)");
check(
  "CA-7",
  "BRL: porcentagem e saldo",
  buildOrderBudgetUsage({ adBudgetBrlCents: 30000, spentCents: 7500, currency: "BRL" }),
  { adBudgetBrlCents: 30000, spentBrlCents: 7500, remainingBrlCents: 22500, percentUsed: 25, currency: "BRL" },
);
check(
  "CA-7",
  "moeda diferente de BRL: sem porcentagem",
  buildOrderBudgetUsage({ adBudgetBrlCents: 30000, spentCents: 7500, currency: "USD" }).percentUsed,
  null,
);

console.log("\nErros da Meta (CA-13, CA-18)");
check("CA-13", "80004 é limite de chamadas", classifyMetaError(80004, false), "rate_limited");
check("CA-13", "190 é token inválido", classifyMetaError(190, false), "token_invalid");
check("CA-13", "200 é permissão", classifyMetaError(200, false), "permission");
check("CA-13", "is_transient é passageiro", classifyMetaError(1, true), "transient");
check(
  "CA-13",
  "lê o tempo de espera do cabeçalho",
  readRetryAfterMinutes(
    new Headers({
      "x-business-use-case-usage": JSON.stringify({ "123": [{ type: "ads_insights", estimated_time_to_regain_access: 7 }] }),
    }),
  ),
  7,
);
const builtUrl = buildMetaGraphUrl("act_1/insights", { fields: "spend", access_token: "SEGREDO" }, "proof");
check("CA-18", "URL nunca leva access_token", builtUrl.includes("access_token"), false);
check("CA-18", "appsecret_proof vai na URL", builtUrl.includes("appsecret_proof=proof"), true);

console.log("\nCorrigir valores (CA-14, CA-15, CA-16)");
const tg0002 = { adBudgetBrlCents: 45000, serviceFeeBrlCents: 0, setupFeeBrlCents: 0, totalBrlCents: 45000, adBudgetPaidToMeta: false };
check(
  "CA-14",
  "TG-0002: 450/0 → 300/150 mantém total 450",
  planOrderValuesCorrection({
    status: "ACCOUNT_REVIEW",
    isLandingPurchase: false,
    current: tg0002,
    next: { adBudgetBrlCents: 30000, serviceFeeBrlCents: 15000, setupFeeBrlCents: 0 },
  }),
  { ok: true, totalBrlCents: 45000, extraCreativesBrlCents: 0 },
);
check("CA-14", "nome do plano regenerado", buildTrafegoPlanName(30000).replace(/\s/g, " "), "Tráfego R$ 300,00");
for (const status of ["SCHEDULED", "RUNNING", "PAUSED", "COMPLETED", "CANCELLED", "REFUNDED"] as const) {
  check(
    "CA-15",
    `recusa em ${status}`,
    planOrderValuesCorrection({
      status,
      isLandingPurchase: false,
      current: tg0002,
      next: { adBudgetBrlCents: 30000, serviceFeeBrlCents: 15000, setupFeeBrlCents: 0 },
    }).ok,
    false,
  );
}
check(
  "CB-11",
  "pedido da landing não muda o total cobrado",
  planOrderValuesCorrection({
    status: "ONBOARDING",
    isLandingPurchase: true,
    current: tg0002,
    next: { adBudgetBrlCents: 30000, serviceFeeBrlCents: 20000, setupFeeBrlCents: 0 },
  }).ok,
  false,
);
check(
  "CA-16",
  "lançamento conciliado bloqueia",
  planFinanceCorrection({
    entries: [{ id: "a", type: "RECEIVABLE", status: "PAID", amount: 100, paidAmount: 100, reconciledTransactionsCount: 1 }],
    nextAdBudgetBrlCents: 30000,
    nextRevenueBrlCents: 15000,
  }).ok,
  false,
);
check(
  "CA-16",
  "repasse já pago bloqueia",
  planFinanceCorrection({
    entries: [{ id: "b", type: "PAYABLE", status: "PAID", amount: 45000, paidAmount: 45000, reconciledTransactionsCount: 0 }],
    nextAdBudgetBrlCents: 30000,
    nextRevenueBrlCents: 15000,
  }).ok,
  false,
);
check(
  "CA-16",
  "repasse em aberto é ajustado",
  planFinanceCorrection({
    entries: [{ id: "c", type: "PAYABLE", status: "PENDING", amount: 45000, paidAmount: 0, reconciledTransactionsCount: 0 }],
    nextAdBudgetBrlCents: 30000,
    nextRevenueBrlCents: 15000,
  }),
  {
    ok: true,
    updates: [{ id: "c", amount: 30000, paidAmount: 0, status: "PENDING" }],
    notes: ["O pedido não tinha lançamento de receita: lance a taxa no Payment se ela foi recebida."],
  },
);

console.log(`\n${passes} ok, ${failures} falha(s)\n`);
process.exit(failures > 0 ? 1 : 0);
