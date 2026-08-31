import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";

/**
 * Config de card do tracking. Lê via $queryRaw pra NÃO depender do Prisma
 * client estar regenerado após a migration (mesmo motivo de
 * `getKanbanAppearance`/`getCardAppearance`): com o client em cache no dev, o
 * `findUnique` só faz SELECT das colunas que o client conhece e omite
 * `card_visibility` silenciosamente. O raw traz a coluna sempre.
 */
type CardConfigRow = {
  id: string;
  tracking_id: string;
  fields: unknown;
  card_visibility: Record<string, boolean> | null;
  show_sla_timer: boolean;
  show_purchase_basket: boolean;
  basket_recent_days: number;
  basket_medium_days: number;
  basket_long_days: number;
};

export const getTrackingCardConfig = base
  .use(requiredAuthMiddleware)
  .route({
    method: "GET",
    summary: "Get card config of a tracking",
    tags: ["Trackings"],
  })
  .input(
    z.object({
      trackingId: z.string(),
    }),
  )
  .handler(async ({ input }) => {
    try {
      const rows = await prisma.$queryRaw<CardConfigRow[]>`
        SELECT
          id,
          tracking_id,
          fields,
          card_visibility,
          show_sla_timer,
          show_purchase_basket,
          basket_recent_days,
          basket_medium_days,
          basket_long_days
        FROM tracking_card_config
        WHERE tracking_id = ${input.trackingId}
        LIMIT 1
      `;

      const row = rows[0];
      if (!row) return { config: null };

      return {
        config: {
          id: row.id,
          trackingId: row.tracking_id,
          fields: row.fields ?? [],
          cardVisibility: row.card_visibility ?? {},
          showSlaTimer: row.show_sla_timer,
          showPurchaseBasket: row.show_purchase_basket,
          basketRecentDays: row.basket_recent_days,
          basketMediumDays: row.basket_medium_days,
          basketLongDays: row.basket_long_days,
        },
      };
    } catch (err) {
      // Resiliente igual a `getKanbanAppearance`/`getCardAppearance`: numa
      // janela de deploy antes da migration a coluna `card_visibility` pode
      // não existir — devolve null em vez de 500 pra não derrubar o board
      // inteiro (o card renderiza tudo visível, comportamento default).
      console.warn(
        "[tracking.getCardConfig] leitura falhou — rode pnpm db:migrate",
        err,
      );
      return { config: null };
    }
  });
