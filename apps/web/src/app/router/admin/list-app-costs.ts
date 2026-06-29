import { requireAdminMiddleware } from "@/app/middlewares/admin";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const listAppCosts = base
  .use(requireAdminMiddleware)
  .route({ method: "GET", summary: "Admin — List app costs", tags: ["Admin"] })
  .input(z.object({}))
  .output(z.array(z.object({
    id:          z.string(),
    appSlug:     z.string(),
    monthlyCost: z.number(),
    setupCost:   z.number(),
    priceBrl:    z.string().nullable(),
    updatedAt:   z.string(),
  })))
  .handler(async () => {
    const costs = await prisma.appStarCost.findMany({
      orderBy: { appSlug: "asc" },
    });

    return costs.map((c) => ({
      id:          c.id,
      appSlug:     c.appSlug,
      monthlyCost: c.monthlyCost,
      setupCost:   c.setupCost,
      priceBrl:    c.priceBrl?.toString() ?? null,
      updatedAt:   c.updatedAt.toISOString(),
    }));
  });
