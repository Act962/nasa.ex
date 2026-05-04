import { requireAdminMiddleware } from "@/app/middlewares/admin";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { FALLBACK_STAR_PRICE_BRL } from "@/features/nasa-route/lib/pricing";

/**
 * Retorna a cotação atual do STAR em BRL + auditoria (quem atualizou, quando).
 * Usado pela página admin `/admin/payments/router-pricing`.
 */
export const getRouterPaymentSettings = base
  .use(requireAdminMiddleware)
  .route({
    method: "GET",
    summary: "Admin — Get Router payment settings (cotação STAR/BRL)",
    tags: ["Admin"],
  })
  .output(
    z.object({
      starPriceBrl: z.number(),
      updatedAt: z.date().nullable(),
      updatedBy: z
        .object({ id: z.string(), name: z.string(), email: z.string() })
        .nullable(),
    }),
  )
  .handler(async () => {
    const row = await prisma.routerPaymentSettings.findUnique({
      where: { id: "singleton" },
      select: {
        starPriceBrl: true,
        updatedAt: true,
        updatedBy: { select: { id: true, name: true, email: true } },
      },
    });

    if (!row) {
      return {
        starPriceBrl: FALLBACK_STAR_PRICE_BRL,
        updatedAt: null,
        updatedBy: null,
      };
    }

    return {
      starPriceBrl: Number(row.starPriceBrl),
      updatedAt: row.updatedAt,
      updatedBy: row.updatedBy,
    };
  });
