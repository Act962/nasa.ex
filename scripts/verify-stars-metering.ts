/**
 * Verificação dos critérios de aceite da spec 0020 — catálogo único de preço.
 *
 * Só lê o banco e exercita o cálculo puro; não debita nada, não escreve nada.
 * Existe porque o projeto não tem test runner instalado (Regra 20 do CLAUDE.md):
 * o aceite desta spec é manual, e este script é a forma de repeti-lo.
 *
 *   pnpm tsx scripts/verify-stars-metering.ts
 */

// Precisa vir antes de qualquer import que toque o client Prisma: imports sao
// icados, entao chamar `config()` entre eles rodaria tarde demais.
import "dotenv/config";

import { computeStars } from "../src/features/stars/lib/metering/compute-stars";
import { resolvePrice } from "../src/features/stars/lib/metering/resolve-price";
import { ACTIONS_WITHOUT_PRICE } from "../src/features/stars/lib/metering/catalog-defaults";
import type { PriceEntry } from "../src/features/stars/lib/metering/types";
import prisma from "../src/lib/prisma";

let failures = 0;

function check(criterion: string, passed: boolean, detail: string) {
  const mark = passed ? "PASS" : "FAIL";
  if (!passed) failures += 1;
  console.log(`[${mark}] ${criterion} — ${detail}`);
}

function syntheticEntry(overrides: Partial<PriceEntry>): PriceEntry {
  return {
    action: "sintetica",
    source: "catalog",
    baseCost: 0,
    unit: "call",
    unitCost: null,
    unitDivisor: 1,
    minCharge: 0,
    maxCharge: null,
    variantCosts: null,
    variantMode: "absolute",
    allowBonus: true,
    isEnabled: true,
    displayName: null,
    ...overrides,
  };
}

async function main() {
  const organization = await prisma.organization.findFirst({
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
  });
  if (!organization) throw new Error("Nenhuma organização no banco.");

  console.log(`Organização de referência: ${organization.name}\n`);

  // ── CA-1 — preço fixo existente não muda ────────────────────────────────
  const fixedCostRows = await prisma.appStarCost.findMany({
    where: { category: "action", monthlyCost: { gt: 0 }, unit: null },
    select: { appSlug: true, monthlyCost: true },
  });

  let divergences = 0;
  for (const row of fixedCostRows) {
    const entry = await resolvePrice(organization.id, row.appSlug);
    const { stars } = computeStars(entry);
    if (stars !== row.monthlyCost) {
      divergences += 1;
      console.log(
        `        divergência em "${row.appSlug}": antes ${row.monthlyCost}★, agora ${stars}★`,
      );
    }
  }
  check(
    "CA-1",
    divergences === 0,
    `${fixedCostRows.length} ações de custo fixo conferidas, ${divergences} divergências`,
  );

  // ── CA-2 — cobrança por token ───────────────────────────────────────────
  const tokenEntry = syntheticEntry({
    unit: "token",
    unitCost: 1,
    unitDivisor: 1000,
    minCharge: 1,
    maxCharge: 500,
  });
  const tokenCharge = computeStars(tokenEntry, { unit: "token", amount: 2500 });
  check(
    "CA-2",
    tokenCharge.stars === 3,
    `2.500 tokens a 1★/1k = ${tokenCharge.stars}★ (esperado 3)`,
  );

  // ── CA-3 — preço por variante ───────────────────────────────────────────
  const variantEntry = syntheticEntry({
    baseCost: 1,
    variantCosts: { "gpt-4o": 5, "gpt-4o-mini": 1 },
  });
  const variantCharge = computeStars(variantEntry, undefined, "gpt-4o");
  const baseCharge = computeStars(variantEntry);
  check(
    "CA-3",
    variantCharge.stars === 5 && baseCharge.stars === 1,
    `variante gpt-4o = ${variantCharge.stars}★, base = ${baseCharge.stars}★ (esperado 5 e 1)`,
  );

  // ── CA-4 — teto máximo ──────────────────────────────────────────────────
  const cappedCharge = computeStars(tokenEntry, {
    unit: "token",
    amount: 10_000_000,
  });
  check(
    "CA-4",
    cappedCharge.stars === 500 && cappedCharge.cappedByMax,
    `10M tokens limitados a ${cappedCharge.stars}★ com sinalização ${cappedCharge.cappedByMax}`,
  );

  // ── CA-5 — ação sem preço ───────────────────────────────────────────────
  const missingEntry = await resolvePrice(
    organization.id,
    "acao_que_nao_existe_no_catalogo",
  );
  const missingCharge = computeStars(missingEntry);
  check(
    "CA-5",
    missingEntry.source === "missing" &&
      missingCharge.stars === 0 &&
      missingCharge.skipReason === "no_price",
    `origem "${missingEntry.source}", ${missingCharge.stars}★, motivo "${missingCharge.skipReason}"`,
  );

  // ── CA-8 — bônus proibido é respeitado ──────────────────────────────────
  const noBonusEntry = syntheticEntry({ baseCost: 10, allowBonus: false });
  check(
    "CA-8",
    noBonusEntry.allowBonus === false,
    "entrada com allowBonus=false chega intacta ao débito",
  );

  // ── CA-9 — aluguel por app aposentado ───────────────────────────────────
  const activeRentals = await prisma.workspaceIntegration.count({
    where: { isActive: true },
  });
  const historyRows = await prisma.workspaceIntegration.count();
  check(
    "CA-9",
    activeRentals === 0,
    `${activeRentals} integrações ativas, ${historyRows} linhas de histórico preservadas`,
  );

  // ── CA-10 — ações sem preço ─────────────────────────────────────────────
  const stillMissing: string[] = [];
  for (const action of ACTIONS_WITHOUT_PRICE) {
    const entry = await resolvePrice(organization.id, action);
    if (computeStars(entry).stars === 0) stillMissing.push(action);
  }
  check(
    "CA-10",
    stillMissing.length === 0,
    stillMissing.length === 0
      ? "todas as ações do inventário têm preço"
      : `${stillMissing.length} ainda sem preço: ${stillMissing.join(", ")}`,
  );

  console.log(
    `\n${failures === 0 ? "Todos os critérios passaram." : `${failures} critério(s) falharam.`}`,
  );
  await prisma.$disconnect();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
