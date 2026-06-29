import { requireAdminMiddleware } from "@/app/middlewares/admin";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { invalidateStarPriceCache } from "@/features/nasa-route/lib/pricing";

/**
 * Atualiza a cotação 1 STAR = R$ X (singleton). Sanity check: 0.01 ≤ x ≤ 100.
 * Limpa o cache em memória após persistir.
 */
export const updateRouterPaymentSettings = base
  .use(requireAdminMiddleware)
  .route({
    method: "POST",
    summary: "Admin — Update Router payment settings (cotação STAR/BRL)",
    tags: ["Admin"],
  })
  .input(
    z.object({
      starPriceBrl: z
        .number()
        .min(0.01, "Cotação mínima: R$ 0,01")
        .max(100, "Cotação máxima: R$ 100,00"),
    }),
  )
  .output(
    z.object({
      starPriceBrl: z.number(),
      updatedAt: z.date(),
    }),
  )
  .handler(async ({ input, context }) => {
    const row = await prisma.routerPaymentSettings.upsert({
      where: { id: "singleton" },
      create: {
        id: "singleton",
        starPriceBrl: input.starPriceBrl,
        updatedById: context.adminUser.id,
      },
      update: {
        starPriceBrl: input.starPriceBrl,
        updatedById: context.adminUser.id,
      },
      select: { starPriceBrl: true, updatedAt: true },
    });

    invalidateStarPriceCache();

    return {
      starPriceBrl: Number(row.starPriceBrl),
      updatedAt: row.updatedAt,
    };
  });
