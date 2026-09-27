import "server-only";
import prisma from "@/lib/prisma";
import { debitStars } from "@/features/stars/lib/star-service";
import { ASTRO_CHAT_APP_SLUG, ASTRO_CHAT_DEFAULT_MONTHLY_STARS, PAUSED_REASON } from "../lib/constants";

/** Mensalidade do ASTRO CHAT em Stars, por site ativo (spec 0031, D-5 e TR-7). */

export async function getAstroChatMonthlyPrice(): Promise<number> {
  const configuredCost = await prisma.appStarCost.findUnique({
    where: { appSlug: ASTRO_CHAT_APP_SLUG },
    select: { monthlyCost: true },
  });
  return configuredCost?.monthlyCost ?? ASTRO_CHAT_DEFAULT_MONTHLY_STARS;
}

function addOneMonth(date: Date): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + 1);
  return next;
}

export type MonthlyChargeResult = { isCharged: boolean; price: number };

/** Cobra o período e avança `nextBillingAt`; sem saldo, pausa o site. */
export async function chargeSiteMonthly(siteId: string): Promise<MonthlyChargeResult> {
  const site = await prisma.astroChatSite.findUnique({
    where: { id: siteId },
    select: { id: true, name: true, organizationId: true, nextBillingAt: true },
  });
  if (!site) return { isCharged: false, price: 0 };

  const price = await getAstroChatMonthlyPrice();
  const now = new Date();
  const periodStart = site.nextBillingAt && site.nextBillingAt > now ? site.nextBillingAt : now;

  if (price > 0) {
    const debit = await debitStars(
      site.organizationId,
      price,
      "APP_CHARGE",
      `ASTRO CHAT — mensalidade do site "${site.name}"`,
      ASTRO_CHAT_APP_SLUG,
    );
    if (!debit.success) {
      await prisma.astroChatSite.update({
        where: { id: site.id },
        data: { pausedReason: PAUSED_REASON.noStars },
      });
      return { isCharged: false, price };
    }
  }

  await prisma.astroChatSite.update({
    where: { id: site.id },
    data: {
      lastBilledAt: now,
      nextBillingAt: addOneMonth(periodStart),
      pausedReason: null,
    },
  });
  return { isCharged: true, price };
}
