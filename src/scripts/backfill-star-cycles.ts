/**
 * Backfill do ciclo de Stars.
 *
 * Orgs criadas antes da renovação automática têm o ciclo congelado na primeira
 * ativação: `starsCycleStart` nunca avançou e a cota nunca foi recreditada. Este
 * script reancora essas orgs no período de cobrança real e aplica UM ciclo — o
 * corrente. Nunca credita os meses perdidos retroativamente.
 *
 * Também separa a parcela protegida (`starsProtectedBalance`): sem isso, a
 * primeira virada apagaria as Stars que o cliente comprou, porque hoje elas
 * vivem indistintas dentro de `starsBalance`.
 *
 * Como rodar:
 *   pnpm tsx --env-file=.env.local src/scripts/backfill-star-cycles.ts            # dry-run
 *   pnpm tsx --env-file=.env.local src/scripts/backfill-star-cycles.ts --apply    # pra valer
 *
 * A flag --env-file é necessária — tsx não auto-carrega .env como o Next faz.
 */

import prisma from "../lib/prisma";
import {
  ensureStarsCycle,
  resolveCycleForOrg,
} from "../features/stars/lib/star-cycle-service";
import { StarTransactionType } from "../generated/prisma/client";

/** Créditos que representam Stars pagas — nunca devem expirar na virada. */
const PROTECTED_CREDIT_TYPES: StarTransactionType[] = [
  StarTransactionType.TOPUP_PURCHASE,
  StarTransactionType.COURSE_PAYOUT,
  StarTransactionType.EVENT_TICKET_PAYOUT,
];

interface BackfillRow {
  orgId: string;
  orgName: string;
  planSlug: string;
  oldCycleStart: string | null;
  newCycleStart: string;
  periodKey: string;
  balanceBefore: number;
  protectedBefore: number;
  protectedAfter: number;
  applied: boolean;
  note: string;
}

async function main(): Promise<void> {
  const isApply = process.argv.includes("--apply");
  const mode = isApply ? "APPLY" : "DRY-RUN";
  console.log(`\n★ Backfill de ciclos de Stars — modo ${mode}\n`);

  const organizations = await prisma.organization.findMany({
    where: { planId: { not: null } },
    select: {
      id: true,
      name: true,
      starsBalance: true,
      starsProtectedBalance: true,
      starsCycleStart: true,
      plan: { select: { slug: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const rows: BackfillRow[] = [];

  for (const org of organizations) {
    const window = await resolveCycleForOrg(org.id);
    if (!window) {
      console.warn(`  ! org ${org.id} sem janela resolvível — pulando`);
      continue;
    }

    // A parcela protegida não é reconstituível com exatidão: os débitos saíram
    // de um pool único e não dá pra saber quanto veio de cada origem. Usamos o
    // total histórico de créditos pagos, limitado ao saldo atual — heurística
    // deliberadamente a favor do cliente, aplicada uma única vez.
    const paidCreditsAgg = await prisma.starTransaction.aggregate({
      where: {
        organizationId: org.id,
        type: { in: PROTECTED_CREDIT_TYPES },
        amount: { gt: 0 },
      },
      _sum: { amount: true },
    });
    const paidCredits = paidCreditsAgg._sum.amount ?? 0;
    const protectedAfter = Math.min(org.starsBalance, paidCredits);

    const alreadyRan = await prisma.orgStarCycle.findUnique({
      where: {
        organizationId_periodKey: {
          organizationId: org.id,
          periodKey: window.periodKey,
        },
      },
      select: { id: true },
    });

    const row: BackfillRow = {
      orgId: org.id,
      orgName: org.name,
      planSlug: org.plan?.slug ?? "—",
      oldCycleStart: org.starsCycleStart?.toISOString() ?? null,
      newCycleStart: window.cycleStart.toISOString(),
      periodKey: window.periodKey,
      balanceBefore: org.starsBalance,
      protectedBefore: org.starsProtectedBalance,
      protectedAfter,
      applied: false,
      note: alreadyRan ? "ciclo corrente já aplicado" : "",
    };

    if (isApply) {
      // O protegido precisa estar correto ANTES do ciclo: é ele que define
      // quanto escapa do teto de rollover.
      if (protectedAfter !== org.starsProtectedBalance) {
        await prisma.organization.update({
          where: { id: org.id },
          data: { starsProtectedBalance: protectedAfter },
        });
      }

      const result = await ensureStarsCycle(org.id, "backfill");
      row.applied = result.applied;
      if (!result.applied && !row.note) {
        row.note = result.reason ?? "não aplicado";
      }
    }

    rows.push(row);
  }

  console.table(
    rows.map((row) => ({
      org: row.orgName.slice(0, 24),
      plano: row.planSlug,
      saldo: row.balanceBefore,
      "protegido→": row.protectedAfter,
      "ciclo antigo": row.oldCycleStart?.slice(0, 10) ?? "—",
      "ciclo novo": row.newCycleStart.slice(0, 10),
      aplicado: row.applied ? "sim" : "não",
      obs: row.note,
    })),
  );

  const totalProtected = rows.reduce((sum, row) => sum + row.protectedAfter, 0);
  console.log(`\n  Orgs analisadas .......... ${rows.length}`);
  console.log(`  Ciclos aplicados ......... ${rows.filter((r) => r.applied).length}`);
  console.log(`  Stars protegidas (total) . ${totalProtected.toLocaleString("pt-BR")} ★`);

  if (!isApply) {
    console.log(
      `\n  Nada foi gravado. Revise a tabela acima e rode de novo com --apply.\n`,
    );
  } else {
    console.log(`\n  Backfill concluído.\n`);
  }
}

main()
  .catch((error) => {
    console.error("Backfill falhou:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
