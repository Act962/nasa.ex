/**
 * Verificação dos critérios de aceite da spec 0021 — registro de custo por evento.
 *
 * Exercita o caminho real de gravação, mas usa uma ação de custo zero para não
 * debitar ★ de ninguém: o evento gratuito também é registrado de propósito, e é
 * justamente esse caso que prova que o ledger funciona sem mexer em saldo.
 *
 * As linhas criadas são removidas no fim.
 *
 *   pnpm tsx scripts/verify-usage-ledger.ts
 */

import "dotenv/config";

import { calculateCost } from "../src/features/ia/lib/token-pricing";
import { getMonetarySettings } from "../src/features/stars/lib/metering/fx";
import { meter } from "../src/features/stars/lib/metering/meter";
import prisma from "../src/lib/prisma";

let failures = 0;
const REQUEST_TAG = `verify-${Date.now()}`;

function check(criterion: string, passed: boolean, detail: string) {
  if (!passed) failures += 1;
  console.log(`[${passed ? "PASS" : "FAIL"}] ${criterion} — ${detail}`);
}

async function main() {
  const organization = await prisma.organization.findFirst({
    select: { id: true, name: true, starsBalance: true },
    orderBy: { createdAt: "asc" },
  });
  if (!organization) throw new Error("Nenhuma organização no banco.");

  const balanceBefore = organization.starsBalance;
  console.log(
    `Organização: ${organization.name} (saldo ${balanceBefore}★)\n`,
  );

  // ── CA-1 / CA-4 — evento gratuito grava custo ───────────────────────────
  // `plan_renewed` está cadastrada com custo zero. Nenhum ★ sai, mas o
  // fornecedor teria cobrado — e é isso que precisa aparecer.
  await meter({
    organizationId: organization.id,
    action: "plan_renewed",
    feature: "verificacao",
    cost: {
      kind: "LLM",
      provider: "openai",
      modelId: "gpt-4o-mini",
      tokens: { inputTokens: 10_000, outputTokens: 2_000, totalTokens: 12_000 },
      latencyMs: 1234,
    },
    metadata: { requestTag: REQUEST_TAG },
  });

  const freeEvent = await prisma.usageEvent.findFirst({
    where: { organizationId: organization.id, action: "plan_renewed" },
    orderBy: { createdAt: "desc" },
  });

  const expected = calculateCost("gpt-4o-mini", 10_000, 2_000);
  check(
    "CA-1/CA-4",
    freeEvent !== null &&
      Number(freeEvent.providerCostUsd) > 0 &&
      freeEvent.starsCharged === 0 &&
      freeEvent.priceSource === "table",
    freeEvent
      ? `custo US$ ${Number(freeEvent.providerCostUsd).toFixed(6)} ` +
          `(esperado ${expected.usd.toFixed(6)}), ${freeEvent.starsCharged}★, ` +
          `origem "${freeEvent.priceSource}"`
      : "nenhum registro gravado",
  );

  check(
    "modelo/provider gravados",
    freeEvent?.modelId === "gpt-4o-mini" && freeEvent?.provider === "openai",
    `modelo "${freeEvent?.modelId}", provider "${freeEvent?.provider}"`,
  );

  // ── CA-6 — modelo fora da tabela vira "unknown", nunca custo zero ───────
  await meter({
    organizationId: organization.id,
    action: "plan_renewed",
    feature: "verificacao",
    cost: {
      kind: "LLM",
      provider: "openai",
      modelId: "modelo-que-nao-existe-v9",
      tokens: { inputTokens: 500, outputTokens: 100, totalTokens: 600 },
    },
    metadata: { requestTag: REQUEST_TAG },
  });

  const unknownEvent = await prisma.usageEvent.findFirst({
    where: {
      organizationId: organization.id,
      modelId: "modelo-que-nao-existe-v9",
    },
    orderBy: { createdAt: "desc" },
  });
  check(
    "CA-6",
    unknownEvent?.priceSource === "unknown" &&
      unknownEvent?.providerCostUsd === null,
    `origem "${unknownEvent?.priceSource}", custo ${unknownEvent?.providerCostUsd ?? "null"} ` +
      "(null é o certo — zero seria indistinguível de gratuito)",
  );

  // ── CB-2 — chave do cliente: custo nosso é zero ────────────────────────
  await meter({
    organizationId: organization.id,
    action: "plan_renewed",
    feature: "verificacao",
    cost: {
      kind: "LLM",
      provider: "anthropic",
      modelId: "claude-haiku-4-5",
      usingCustomKey: true,
      tokens: { inputTokens: 50_000, outputTokens: 10_000, totalTokens: 60_000 },
    },
    metadata: { requestTag: REQUEST_TAG },
  });

  const byoEvent = await prisma.usageEvent.findFirst({
    where: { organizationId: organization.id, usingCustomKey: true },
    orderBy: { createdAt: "desc" },
  });
  check(
    "CB-2",
    byoEvent !== null &&
      Number(byoEvent.providerCostUsd) === 0 &&
      byoEvent.priceSource === "byo_key",
    `custo US$ ${byoEvent ? Number(byoEvent.providerCostUsd) : "?"} com chave do cliente ` +
      "(zero é o certo — quem paga o provider é ele)",
  );

  // ── CA-9 — câmbio gravado no evento ────────────────────────────────────
  const { usdToBrlRate, starPriceBrl } = await getMonetarySettings();
  check(
    "câmbio persistido",
    freeEvent !== null && Number(freeEvent.usdToBrlRate) === usdToBrlRate,
    `taxa ${usdToBrlRate} gravada no evento; ★ a R$ ${starPriceBrl} ` +
      "(o passado não é reescrito quando o câmbio mudar)",
  );

  // ── Saldo intacto ──────────────────────────────────────────────────────
  const after = await prisma.organization.findUniqueOrThrow({
    where: { id: organization.id },
    select: { starsBalance: true },
  });
  check(
    "saldo intacto",
    after.starsBalance === balanceBefore,
    `${balanceBefore}★ antes, ${after.starsBalance}★ depois`,
  );

  // ── CA-10 — dá pra apurar custo por organização, solução e modelo ──────
  const byModel = await prisma.usageEvent.groupBy({
    by: ["modelId"],
    where: { organizationId: organization.id },
    _sum: { providerCostUsd: true, starsCharged: true },
    _count: true,
  });
  check(
    "CA-10",
    byModel.length > 0,
    `apuração por modelo devolveu ${byModel.length} linha(s)`,
  );

  // ── Limpeza ────────────────────────────────────────────────────────────
  const removed = await prisma.usageEvent.deleteMany({
    where: { organizationId: organization.id, feature: "verificacao" },
  });
  console.log(`\nLimpeza: ${removed.count} registro(s) de teste removido(s).`);

  console.log(
    failures === 0
      ? "Todos os critérios passaram."
      : `${failures} critério(s) falharam.`,
  );
  await prisma.$disconnect();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
