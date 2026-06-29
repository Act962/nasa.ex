/**
 * Cron: partner-grace-period-monitor
 *
 * Roda diariamente às 06:00 UTC. Notifica parceiros sobre prazos de
 * carência se aproximando (T-7 e T-1 dias) e marca downgrade quando
 * a carência expira.
 */

import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";

export const partnerGracePeriodMonitor = inngest.createFunction(
  { id: "partner-grace-period-monitor", retries: 1 },
  { cron: "0 6 * * *" },
  async ({ step }) => {
    const now = new Date();
    const sevenDaysAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Parceiros em carência ativa
    const inGrace = await step.run("fetch-in-grace", () =>
      prisma.partner.findMany({
        where: { gracePeriodEndsAt: { gte: now } },
        select: {
          id: true,
          userId: true,
          gracePeriodEndsAt: true,
          gracePeriodFromTier: true,
          gracePeriodToTier: true,
        },
      }),
    );

    let warnedT7 = 0,
      warnedT1 = 0;

    for (const p of inGrace) {
      if (!p.gracePeriodEndsAt) continue;
      // step.run serializes Date to ISO string; reconstrói Date para arithmetic.
      const endsAt = new Date(p.gracePeriodEndsAt as unknown as string);
      const daysLeft = Math.ceil(
        (endsAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
      );

      if (daysLeft === 7 && endsAt <= sevenDaysAhead) {
        await prisma.userNotification.create({
          data: {
            userId: p.userId,
            type: "CUSTOM",
            title: "Sua qualificação como parceiro está em risco",
            body: `Faltam 7 dias para você cair de ${p.gracePeriodFromTier ?? "?"} para ${p.gracePeriodToTier ?? "?"}. Engaje suas empresas em risco.`,
            actionUrl: "/partner/indicacoes",
          },
        });
        warnedT7++;
      } else if (daysLeft === 1) {
        await prisma.userNotification.create({
          data: {
            userId: p.userId,
            type: "CUSTOM",
            title: "Última chance: carência termina amanhã",
            body: `Amanhã seu nível será rebaixado para ${p.gracePeriodToTier ?? "nível inferior"}.`,
            actionUrl: "/partner/indicacoes",
          },
        });
        warnedT1++;
      }
    }

    return { totalInGrace: inGrace.length, warnedT7, warnedT1 };
  },
);
