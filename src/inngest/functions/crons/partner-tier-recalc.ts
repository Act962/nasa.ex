/**
 * Cron: partner-tier-recalc
 *
 * Roda diariamente às 03:00 UTC e também é disparado por evento
 * `partner/tier.recalc-many` após o recálculo de atividade.
 * Para cada Partner, decide upgrade/downgrade/grace conforme regras.
 */

import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import { recalcPartnerTier } from "@/features/partner/lib/partner-service";

export const partnerTierRecalcDaily = inngest.createFunction(
  { id: "partner-tier-recalc-daily", retries: 1 },
  { cron: "0 3 * * *" },
  async ({ step }) => {
    const partners = await step.run("fetch-partners", () =>
      prisma.partner.findMany({
        select: { id: true, userId: true },
        where: { status: { not: "SUSPENDED" } },
      }),
    );

    let upgraded = 0,
      downgraded = 0,
      graceStarted = 0,
      noChange = 0;

    for (const p of partners) {
      const result = await recalcPartnerTier(p.id);
      if (result.reason === "auto_upgrade" || result.reason === "first_activation") upgraded++;
      else if (result.reason === "grace_expired") downgraded++;
      else if (result.reason === "grace_started") graceStarted++;
      else noChange++;
    }

    return {
      total: partners.length,
      upgraded,
      downgraded,
      graceStarted,
      noChange,
    };
  },
);

export const partnerTierRecalcMany = inngest.createFunction(
  { id: "partner-tier-recalc-many", retries: 1 },
  { event: "partner/tier.recalc-many" },
  async ({ event }) => {
    const ids = (event.data as { partnerUserIds: string[] }).partnerUserIds;
    const partners = await prisma.partner.findMany({
      where: { userId: { in: ids } },
      select: { id: true },
    });
    let processed = 0;
    for (const p of partners) {
      await recalcPartnerTier(p.id);
      processed++;
    }
    return { processed };
  },
);

export const partnerTierRecalcOne = inngest.createFunction(
  { id: "partner-tier-recalc-one", retries: 1 },
  { event: "partner/tier.recalc" },
  async ({ event }) => {
    const partnerId = (event.data as { partnerId: string }).partnerId;
    const result = await recalcPartnerTier(partnerId);
    return result;
  },
);
