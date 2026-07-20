/**
 * Cron: stars-cycle-renew
 *
 * Rede de segurança da renovação de Stars. O gatilho primário é o webhook de
 * assinatura (`stars/cycle.ensure`); este cron existe porque:
 *
 *   - orgs sem assinatura Stripe (plano manual via admin, `partnerLifetimeGranted`)
 *     nunca recebem webhook;
 *   - webhook perdido significaria ciclo congelado — que é exatamente o bug que
 *     esta feature corrige.
 *
 * Roda de hora em hora e varre apenas orgs com `starsCycleEnd` vencido, então o
 * custo é proporcional ao que realmente virou. O crédito é idempotente por
 * `periodKey`, então concorrer com o webhook é seguro.
 */

import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import { ensureStarsCycle } from "@/features/stars/lib/star-cycle-service";
import { createOrgNotification } from "@/features/admin/lib/notification-service";

const BATCH_SIZE = 200;
/** Além disso, o ciclo está travado — sinaliza regressão, não atraso normal. */
const STUCK_CYCLE_HOURS = 48;

export const starsCycleRenew = inngest.createFunction(
  { id: "stars-cycle-renew", retries: 2 },
  { cron: "15 * * * *" },
  async ({ step }) => {
    const now = new Date();

    const dueOrgs = await step.run("fetch-due-orgs", () =>
      prisma.organization.findMany({
        where: {
          planId: { not: null },
          OR: [
            { starsCycleEnd: { lte: now } },
            // Orgs com plano que nunca passaram por um ciclo (âncora ausente).
            { starsCycleEnd: null },
          ],
        },
        select: { id: true, name: true, starsCycleEnd: true },
        take: BATCH_SIZE,
        orderBy: { starsCycleEnd: "asc" },
      }),
    );

    let applied = 0;
    let skippedDunning = 0;
    let duplicates = 0;
    let failed = 0;
    const stuck: string[] = [];

    for (const org of dueOrgs) {
      try {
        const result = await ensureStarsCycle(org.id, "cron");

        if (result.applied) {
          applied++;
          await createOrgNotification({
            organizationId: org.id,
            type: "STARS_ALERT",
            severity: "info",
            title: "Stars renovadas",
            body: `Seu plano creditou ${result.credited?.toLocaleString("pt-BR")} ★ para o novo ciclo${
              result.rollover
                ? ` (+${result.rollover.toLocaleString("pt-BR")} ★ de rollover)`
                : ""
            }.`,
          });
        } else if (result.reason === "dunning") {
          skippedDunning++;
        } else if (result.reason === "duplicate") {
          duplicates++;
        }

        // `step.run` serializa o retorno: `starsCycleEnd` chega como string ISO.
        if (org.starsCycleEnd && !result.applied) {
          const cycleEndAt = new Date(org.starsCycleEnd).getTime();
          const hoursOverdue = (now.getTime() - cycleEndAt) / (1000 * 60 * 60);
          if (hoursOverdue >= STUCK_CYCLE_HOURS) {
            stuck.push(org.id);
          }
        }
      } catch (error) {
        failed++;
        console.error(
          `[stars/cycle] cron failed for org ${org.id}:`,
          error,
        );
      }
    }

    if (stuck.length > 0) {
      console.error(
        `[stars/cycle] ${stuck.length} org(s) com ciclo vencido há mais de ${STUCK_CYCLE_HOURS}h sem renovar: ${stuck.join(", ")}`,
      );
    }

    return {
      scannedAt: now.toISOString(),
      scanned: dueOrgs.length,
      applied,
      skippedDunning,
      duplicates,
      failed,
      stuck: stuck.length,
    };
  },
);
