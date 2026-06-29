import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import { requireOrgMiddleware } from "../../middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

/**
 * Devolve os campos de aparência do card no dashboard (cor da borda,
 * imagem de fundo, blur, opacity). Usado pela tab "Personalização" no
 * settings do tracking. Lê via $queryRaw pra não depender do Prisma client
 * estar regenerado após a migration.
 */
export const getCardAppearance = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    summary: "Card appearance fields of a tracking",
    tags: ["Trackings"],
  })
  .input(
    z.object({
      trackingId: z.string(),
    }),
  )
  .handler(async ({ input }) => {
    try {
      const rows = await prisma.$queryRaw<
        Array<{
          card_border_color: string | null;
          card_background_image: string | null;
          card_background_blur: number | null;
          card_background_opacity: number | null;
        }>
      >`SELECT card_border_color, card_background_image, card_background_blur, card_background_opacity FROM tracking WHERE id = ${input.trackingId} LIMIT 1`;

      const row = rows[0];
      return {
        cardBorderColor: row?.card_border_color ?? null,
        cardBackgroundImage: row?.card_background_image ?? null,
        cardBackgroundBlur: row?.card_background_blur ?? 8,
        cardBackgroundOpacity: row?.card_background_opacity ?? 25,
      };
    } catch (e) {
      console.warn(
        "[tracking.getCardAppearance] columns missing — run pnpm prisma migrate deploy",
        e,
      );
      return {
        cardBorderColor: null,
        cardBackgroundImage: null,
        cardBackgroundBlur: 8,
        cardBackgroundOpacity: 25,
      };
    }
  });
