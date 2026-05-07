/**
 * Cron: partner-referral-activity-recalc
 *
 * Roda diariamente às 02:30 UTC. Para cada PartnerReferral, recalcula
 * `activityStatus` (ACTIVE/AT_RISK/INACTIVE) com base na janela vigente
 * de `PartnerProgramSettings.activeOrgWindowDays`.
 *
 * Após processar todos os referrals, emite event para reavaliar tier
 * dos parceiros afetados.
 */

import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import { recalcReferralActivity } from "@/features/partner/lib/partner-service";

const BATCH_SIZE = 200;

export const partnerReferralActivityRecalc = inngest.createFunction(
  { id: "partner-referral-activity-recalc", retries: 1 },
  { cron: "30 2 * * *" },
  async ({ step }) => {
    const total = await step.run("count-referrals", () =>
      prisma.partnerReferral.count(),
    );

    const affectedPartners = new Set<string>();
    let processed = 0;

    for (let offset = 0; offset < total; offset += BATCH_SIZE) {
      const batch = await step.run(`fetch-batch-${offset}`, () =>
        prisma.partnerReferral.findMany({
          skip: offset,
          take: BATCH_SIZE,
          select: { id: true, partnerUserId: true, activityStatus: true },
          orderBy: { id: "asc" },
        }),
      );

      for (const r of batch) {
        const result = await recalcReferralActivity(r.id);
        if (result.status !== r.activityStatus) {
          affectedPartners.add(r.partnerUserId);
        }
        processed++;
      }
    }

    // Emite eventos de tier-recalc para parceiros afetados
    if (affectedPartners.size > 0) {
      await step.sendEvent("emit-tier-recalc", {
        name: "partner/tier.recalc-many",
        data: { partnerUserIds: Array.from(affectedPartners) },
      });
    }

    return { processed, affectedPartners: affectedPartners.size };
  },
);
