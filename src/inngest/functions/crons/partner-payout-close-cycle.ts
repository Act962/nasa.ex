/**
 * Cron: partner-payout-close-cycle
 *
 * Roda no dia 1 às 00:05 UTC do mês seguinte.
 * Para cada parceiro com comissões PENDING no mês fechado:
 *   - Soma `commissionBrl`
 *   - Cria PartnerPayout SCHEDULED com `cycleYearMonth` do mês fechado
 *   - Atualiza comissões: status=READY, payoutId
 */

import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import { getProgramSettings, nextPayoutDate } from "@/features/partner/lib/partner-service";

function previousCycleYearMonth(date: Date = new Date()): string {
  const d = new Date(date);
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - 1);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export const partnerPayoutCloseCycle = inngest.createFunction(
  { id: "partner-payout-close-cycle", retries: 1 },
  { cron: "5 0 1 * *" },
  async ({ step }) => {
    const cycle = previousCycleYearMonth();
    const settings = await step.run("get-settings", () => getProgramSettings());

    const groups = await step.run("aggregate-pending", () =>
      prisma.partnerCommission.groupBy({
        by: ["partnerId"],
        where: {
          status: "PENDING",
          cycleYearMonth: cycle,
        },
        _sum: { commissionBrl: true },
        _count: { _all: true },
      }),
    );

    const cycleStart = new Date(`${cycle}-01T00:00:00.000Z`);
    const cycleEnd = new Date(cycleStart);
    cycleEnd.setUTCMonth(cycleEnd.getUTCMonth() + 1);
    cycleEnd.setUTCMilliseconds(-1);

    const scheduledFor = nextPayoutDate(cycle, settings.payoutDayOfMonth);

    let createdCount = 0;
    for (const g of groups) {
      const gross = Number(g._sum.commissionBrl ?? 0);
      if (gross <= 0) continue;
      try {
        const payout = await prisma.$transaction(async (tx) => {
          const created = await tx.partnerPayout.create({
            data: {
              partnerId: g.partnerId,
              cycleYearMonth: cycle,
              cycleStart,
              cycleEnd,
              scheduledFor,
              grossBrl: gross,
              advanceFeeBrl: 0,
              netBrl: gross,
              status: "SCHEDULED",
            },
          });
          await tx.partnerCommission.updateMany({
            where: {
              partnerId: g.partnerId,
              cycleYearMonth: cycle,
              status: "PENDING",
            },
            data: { status: "READY", payoutId: created.id },
          });
          return created;
        });
        if (payout) createdCount++;
      } catch (err) {
        // Conflito de unique (já existe payout para o ciclo) — ignora silenciosamente
        const e = err as { code?: string };
        if (e.code !== "P2002") throw err;
      }
    }

    return { cycle, partnersClosed: createdCount };
  },
);
