import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import { chargeSiteMonthly } from "@/features/astro-chat/server/billing";
import { PAUSED_REASON } from "@/features/astro-chat/lib/constants";

/** Cron diário da mensalidade do ASTRO CHAT (spec 0031, D-5 e CB-7). */

const BATCH_LIMIT = 500;

export const astroChatMonthlyBilling = inngest.createFunction(
  { id: "astro-chat-monthly-billing", retries: 1 },
  { cron: "TZ=America/Sao_Paulo 0 6 * * *" },
  async ({ step }) => {
    const dueSites = await step.run("load-due-sites", () =>
      prisma.astroChatSite.findMany({
        where: {
          isEnabled: true,
          pausedReason: null,
          nextBillingAt: { not: null, lte: new Date() },
        },
        select: { id: true, organization: { select: { starsSuspendedAt: true } } },
        take: BATCH_LIMIT,
      }),
    );

    let chargedCount = 0;
    let pausedCount = 0;
    for (const site of dueSites) {
      const outcome = await step.run(`charge-${site.id}`, async () => {
        if (site.organization.starsSuspendedAt) {
          await prisma.astroChatSite.update({
            where: { id: site.id },
            data: { pausedReason: PAUSED_REASON.noStars },
          });
          return { isCharged: false };
        }
        return chargeSiteMonthly(site.id);
      });
      if (outcome.isCharged) chargedCount++;
      else pausedCount++;
    }
    return { due: dueSites.length, charged: chargedCount, paused: pausedCount };
  },
);
