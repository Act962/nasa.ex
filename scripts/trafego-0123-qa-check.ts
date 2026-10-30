// Conferência das regras puras da spec 0123 (cobrança só do serviço, complemento e trava).
// Não há runner de testes no projeto (CLAUDE.md, regra 20): cada CA-n vira uma asserção aqui.
// Nenhuma chamada de rede nem de banco.
//
//   pnpm tsx scripts/trafego-0123-qa-check.ts

import { computeTrafegoServiceFee, quoteTrafego } from "../src/features/trafego/lib/pricing-tiers";
import { deriveExtraCreativesBrlCents } from "../src/features/trafego/lib/order-values";
import {
  computeComplementDue,
  hasOverdueComplement,
  isComplementEligibleOrder,
  nextComplementDocumentNumber,
  resolveComplementWindow,
  sumServiceSpendBrlCents,
  type ComplementEntrySnapshot,
} from "../src/features/trafego/lib/complement";

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

function complement(overrides: Partial<ComplementEntrySnapshot>): ComplementEntrySnapshot {
  return {
    id: "c1",
    documentNumber: "TG-0002-C1",
    amount: 45_000,
    paidAmount: 0,
    status: "PENDING",
    dueDate: new Date("2026-11-02T12:00:00Z"),
    dunningRuleId: null,
    createdAt: new Date("2026-10-30T03:00:00Z"),
    ...overrides,
  };
}

console.log("\nPreço (CA-1)");
check("CA-1", "R$ 300 → taxa R$ 150 (mínimo)", computeTrafegoServiceFee(30_000), 15_000);
check("CA-1", "R$ 1.000 → taxa R$ 300", computeTrafegoServiceFee(100_000), 30_000);
check("CA-1", "R$ 5.000 → taxa R$ 1.500", computeTrafegoServiceFee(500_000), 150_000);
check("CA-1", "R$ 300 sem conta → setup R$ 500", quoteTrafego(30_000, true).setupBrlCents, 50_000);
check("CA-2", "total cobrado sem a verba", quoteTrafego(100_000, false).totalBrlCents, 30_000);

console.log("\nCriativos extras por modelo (CA-4)");
check(
  "CA-4",
  "modelo novo com 2 extras de R$ 40 não zera",
  deriveExtraCreativesBrlCents({
    adBudgetBrlCents: 30_000,
    serviceFeeBrlCents: 15_000,
    setupFeeBrlCents: 0,
    totalBrlCents: 23_000,
    adBudgetPaidToMeta: true,
  }),
  8_000,
);
check(
  "CA-4",
  "modelo antigo segue a conta de antes",
  deriveExtraCreativesBrlCents({
    adBudgetBrlCents: 30_000,
    serviceFeeBrlCents: 15_000,
    setupFeeBrlCents: 0,
    totalBrlCents: 53_000,
    adBudgetPaidToMeta: false,
  }),
  8_000,
);

console.log("\nComplemento (CA-8, CA-9, CA-10)");
const firstRun = computeComplementDue({ adBudgetBrlCents: 30_000, serviceFeeBrlCents: 15_000, spentBrlCents: 200_000, complements: [] });
check("CA-8", "gasto R$ 2.000: devido R$ 600, complemento R$ 450", [firstRun.dueFeeBrlCents, firstRun.complementBrlCents, firstRun.shouldCreate], [60_000, 45_000, true]);
check("CA-8", "primeiro número é TG-0002-C1", nextComplementDocumentNumber("TG-0002", []), "TG-0002-C1");
const secondRun = computeComplementDue({
  adBudgetBrlCents: 30_000,
  serviceFeeBrlCents: 15_000,
  spentBrlCents: 200_000,
  complements: [complement({})],
});
check("CA-8", "rodar de novo no mesmo dia não cria C2", secondRun.shouldCreate, false);
check(
  "CA-11",
  "complemento cancelado sai do já cobrado",
  computeComplementDue({
    adBudgetBrlCents: 30_000,
    serviceFeeBrlCents: 15_000,
    spentBrlCents: 200_000,
    complements: [complement({ status: "CANCELLED" })],
  }).complementBrlCents,
  45_000,
);
check(
  "CA-11",
  "número novo pula o cancelado",
  nextComplementDocumentNumber("TG-0002", ["TG-0002-C1", "TG-00021-C4"]),
  "TG-0002-C2",
);
check(
  "CA-9",
  "campanha fora do trafeGO sai do gasto",
  sumServiceSpendBrlCents(
    [
      { campaignId: "1", spendBrlCents: 50_000 },
      { campaignId: "2", spendBrlCents: 150_000 },
    ],
    ["2"],
  ),
  50_000,
);
check(
  "CA-10",
  "gasto abaixo da verba declarada não gera",
  computeComplementDue({ adBudgetBrlCents: 100_000, serviceFeeBrlCents: 15_000, spentBrlCents: 90_000, complements: [] }).shouldCreate,
  false,
);
check(
  "CA-10",
  "diferença abaixo de R$ 30 não gera",
  computeComplementDue({ adBudgetBrlCents: 50_000, serviceFeeBrlCents: 15_000, spentBrlCents: 59_000, complements: [] }).shouldCreate,
  false,
);
check(
  "CB-5",
  "pago em parte conta pelo valor cheio",
  computeComplementDue({
    adBudgetBrlCents: 30_000,
    serviceFeeBrlCents: 15_000,
    spentBrlCents: 200_000,
    complements: [complement({ status: "PARTIAL", paidAmount: 10_000 })],
  }).complementBrlCents,
  0,
);

console.log("\nJanela do gasto (CB-3, CB-6)");
const now = new Date("2026-11-20T15:00:00Z");
check("CB-3", "sem startedAt não calcula", resolveComplementWindow({ startedAt: null, endsAt: null, timeZone: null, now }), null);
check(
  "CB-6",
  "terminado há mais de 3 dias para de calcular",
  resolveComplementWindow({
    startedAt: new Date("2026-11-01T12:00:00Z"),
    endsAt: new Date("2026-11-10T12:00:00Z"),
    timeZone: null,
    now,
  }),
  null,
);
check(
  "RF-11",
  "dentro da carência conta até hoje",
  resolveComplementWindow({
    startedAt: new Date("2026-11-01T12:00:00Z"),
    endsAt: new Date("2026-11-18T12:00:00Z"),
    timeZone: "America/Sao_Paulo",
    now,
  }),
  { since: "2026-11-01", until: "2026-11-20" },
);

console.log("\nTrava (CA-12, CA-13)");
check(
  "CA-12",
  "enviado e vencido trava",
  hasOverdueComplement([complement({ dunningRuleId: "regua", dueDate: new Date("2026-11-19T12:00:00Z") })], now),
  true,
);
check(
  "CA-12",
  "rascunho vencido não trava",
  hasOverdueComplement([complement({ dueDate: new Date("2026-11-19T12:00:00Z") })], now),
  false,
);
check(
  "CA-12",
  "vence hoje ainda não trava",
  hasOverdueComplement([complement({ dunningRuleId: "regua", dueDate: new Date("2026-11-20T12:00:00Z") })], now),
  false,
);
check(
  "CA-12",
  "pago não trava",
  hasOverdueComplement([complement({ dunningRuleId: "regua", status: "PAID", dueDate: new Date("2026-11-01T12:00:00Z") })], now),
  false,
);
check(
  "CA-13",
  "pedido antigo nunca gera complemento",
  isComplementEligibleOrder({ platform: "META_ADS", adBudgetPaidToMeta: false, startedAt: now, status: "RUNNING" }),
  false,
);
check(
  "CA-13",
  "pedido novo no ar é elegível",
  isComplementEligibleOrder({ platform: "META_ADS", adBudgetPaidToMeta: true, startedAt: now, status: "RUNNING" }),
  true,
);

console.log(`\n${passes} ok, ${failures} falha(s)\n`);
process.exit(failures > 0 ? 1 : 0);
