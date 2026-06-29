import { requireAdminMiddleware } from "@/app/middlewares/admin";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const updateAppCost = base
  .use(requireAdminMiddleware)
  .route({ method: "POST", summary: "Admin — Update app cost", tags: ["Admin"] })
  .input(z.object({
    appSlug:     z.string(),
    monthlyCost: z.number().int().min(0),
    setupCost:   z.number().int().min(0),
    priceBrl:    z.string().nullable(),
  }))
  .output(z.object({ success: z.boolean() }))
  .handler(async ({ input }) => {
    await prisma.appStarCost.upsert({
      where:  { appSlug: input.appSlug },
      create: {
        appSlug:     input.appSlug,
        monthlyCost: input.monthlyCost,
        setupCost:   input.setupCost,
        priceBrl:    input.priceBrl ? parseFloat(input.priceBrl) : null,
      },
      update: {
        monthlyCost: input.monthlyCost,
        setupCost:   input.setupCost,
        priceBrl:    input.priceBrl ? parseFloat(input.priceBrl) : null,
      },
    });

    return { success: true };
  });
