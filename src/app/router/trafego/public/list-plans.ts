import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { computeTrafegoPrice } from "@/features/trafego/lib/pricing";
import { trafegoPlatformSchema } from "@/features/trafego/schema/trafego-schemas";

/**
 * Catálogo público do trafeGO — consumido pelo wizard em `/trafego`, sem auth.
 *
 * Devolve o preço já decomposto (verba + taxa + total) porque a landing precisa
 * mostrar as duas parcelas, e recalcular isso no client abriria espaço pra
 * divergência com o que o checkout cobra.
 */
export const listPublicTrafegoPlans = base
  .route({ method: "GET", summary: "Catálogo público de planos trafeGO" })
  .input(z.object({ platform: trafegoPlatformSchema.optional() }))
  .handler(async ({ input }) => {
    const plans = await prisma.trafegoPlan.findMany({
      where: {
        isActive: true,
        ...(input.platform ? { platform: input.platform } : {}),
      },
      orderBy: [{ position: "asc" }, { adBudgetBrlCents: "asc" }],
      select: {
        id: true,
        slug: true,
        name: true,
        headline: true,
        description: true,
        platform: true,
        campaignTypes: true,
        objectives: true,
        adBudgetBrlCents: true,
        serviceFeePercent: true,
        serviceFeeBrlCents: true,
        durationDays: true,
        maxCreatives: true,
        maxCopies: true,
        highlights: true,
        isDefault: true,
        position: true,
      },
    });

    return plans.map((plan) => {
      const price = computeTrafegoPrice({
        adBudgetBrlCents: plan.adBudgetBrlCents,
        serviceFeePercent: Number(plan.serviceFeePercent),
        serviceFeeBrlCents: plan.serviceFeeBrlCents,
      });
      return {
        id: plan.id,
        slug: plan.slug,
        name: plan.name,
        headline: plan.headline,
        description: plan.description,
        platform: plan.platform,
        campaignTypes: plan.campaignTypes,
        objectives: plan.objectives,
        durationDays: plan.durationDays,
        maxCreatives: plan.maxCreatives,
        maxCopies: plan.maxCopies,
        highlights: plan.highlights,
        isDefault: plan.isDefault,
        adBudgetBrlCents: price.adBudgetBrlCents,
        serviceFeeBrlCents: price.serviceFeeBrlCents,
        totalBrlCents: price.totalBrlCents,
      };
    });
  });
