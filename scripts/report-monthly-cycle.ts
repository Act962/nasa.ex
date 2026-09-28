/**
 * Simulação do ciclo mensal de Stars — organização por organização.
 *
 * NÃO ESCREVE NADA. Mostra o que aconteceria ao ligar o cron
 * `stars-monthly-cycle`, incluindo quanto saldo cada organização perderia pelo
 * teto de rollover.
 *
 * Por que isto existe: o ciclo nunca rodou uma segunda vez, então há
 * organizações com saldo acumulado de vários meses. O ciclo capa o que passa
 * adiante em `rolloverPct` da franquia do plano — ligar sem olhar derrubaria
 * esse saldo sem aviso. A decisão de ligar é de produto, e este é o número em
 * cima do qual ela se toma.
 *
 *   pnpm tsx scripts/report-monthly-cycle.ts
 */

import "dotenv/config";

import { runMonthlyCycle } from "../src/features/stars/lib/star-service";
import prisma from "../src/lib/prisma";

const CYCLE_DAYS = 30;

function pad(value: string | number, width: number, right = false) {
  const text = String(value);
  return right ? text.padStart(width) : text.padEnd(width);
}

async function main() {
  const threshold = new Date(Date.now() - CYCLE_DAYS * 24 * 60 * 60 * 1000);

  const organizations = await prisma.organization.findMany({
    where: {
      planId: { not: null },
      OR: [{ starsCycleStart: null }, { starsCycleStart: { lte: threshold } }],
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  console.log(
    `Simulação do ciclo mensal — ${new Date().toISOString().slice(0, 10)}\n`,
  );
  console.log(
    `${organizations.length} organização(ões) com ciclo vencido (mais de ${CYCLE_DAYS} dias).\n`,
  );

  if (organizations.length === 0) {
    console.log("Nada a fazer.");
    await prisma.$disconnect();
    return;
  }

  console.log(
    `${pad("ORGANIZAÇÃO", 32)} ${pad("PLANO", 15)} ${pad("DIAS", 5, true)} ` +
      `${pad("SALDO HOJE", 11, true)} ${pad("ROLLOVER", 9, true)} ` +
      `${pad("PERDE", 8, true)} ${pad("SALDO DEPOIS", 13, true)}`,
  );
  console.log("-".repeat(100));

  let forfeitedTotal = 0;
  let creditedTotal = 0;
  const losers: Array<{ name: string; forfeited: number }> = [];

  for (const organization of organizations) {
    const result = await runMonthlyCycle(organization.id, { dryRun: true });

    if (result.skipReason) {
      console.log(
        `${pad(organization.name.slice(0, 31), 32)} ${pad(result.planName ?? "—", 15)} ` +
          `${pad(result.cycleAgeDays ?? "—", 5, true)} — pulada (${result.skipReason})`,
      );
      continue;
    }

    forfeitedTotal += result.forfeited;
    creditedTotal += result.planStars;
    if (result.forfeited > 0) {
      losers.push({ name: organization.name, forfeited: result.forfeited });
    }

    console.log(
      `${pad(organization.name.slice(0, 31), 32)} ${pad(result.planName ?? "—", 15)} ` +
        `${pad(result.cycleAgeDays ?? "—", 5, true)} ` +
        `${pad(result.balanceBefore, 11, true)} ${pad(result.rollover, 9, true)} ` +
        `${pad(result.forfeited, 8, true)} ${pad(result.balanceAfter, 13, true)}`,
    );
  }

  console.log("-".repeat(100));
  console.log(`\nCréditos de franquia a distribuir: ${creditedTotal}★`);
  console.log(`Saldo que seria perdido pelo teto: ${forfeitedTotal}★`);

  if (losers.length > 0) {
    console.log(
      `\n⚠️  ${losers.length} organização(ões) perderiam saldo acumulado:\n`,
    );
    for (const loser of losers.sort((a, b) => b.forfeited - a.forfeited)) {
      console.log(`    ${pad(loser.name.slice(0, 40), 42)} -${loser.forfeited}★`);
    }
    console.log(
      "\nEsse saldo foi acumulado porque o ciclo nunca rodou — não porque o\n" +
        "cliente deixou de usar. Decida antes de ligar o cron:\n" +
        "  a) ligar assim mesmo e comunicar;\n" +
        "  b) creditar a diferença de volta com um ajuste manual registrado;\n" +
        "  c) elevar `rolloverPct` só no primeiro ciclo corrigido.",
    );
  } else {
    console.log("\nNenhuma organização perderia saldo. Seguro ligar.");
  }

  console.log(
    "\nNada foi escrito. Para aplicar, defina STARS_MONTHLY_CYCLE_CRON=true.",
  );
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
