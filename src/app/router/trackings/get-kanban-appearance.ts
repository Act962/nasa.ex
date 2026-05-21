import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import { requireOrgMiddleware } from "../../middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

/**
 * Devolve campos de aparência do KANBAN (cores de card, coluna e canvas
 * do tracking + imagem de fundo do canvas). Lê via $queryRaw pra não
 * depender do Prisma client estar regenerado após a migration.
 *
 * NOTA: diferente de `getCardAppearance` (cuida do card no DASHBOARD
 * de tracking — lista de trackings da org), esta procedure cuida da
 * VIEW de pipeline (kanban) — cards de lead + colunas de status.
 */
export const getKanbanAppearance = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    summary: "Kanban appearance fields of a tracking",
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
          kanban_card_background_color: string | null;
          kanban_card_border_color: string | null;
          kanban_card_background_opacity: number | null;
          kanban_column_background_color: string | null;
          kanban_column_border_color: string | null;
          kanban_column_background_opacity: number | null;
          kanban_background_color: string | null;
          kanban_background_image: string | null;
          kanban_background_blur: number | null;
          kanban_background_opacity: number | null;
        }>
      >`
        SELECT
          kanban_card_background_color,
          kanban_card_border_color,
          kanban_card_background_opacity,
          kanban_column_background_color,
          kanban_column_border_color,
          kanban_column_background_opacity,
          kanban_background_color,
          kanban_background_image,
          kanban_background_blur,
          kanban_background_opacity
        FROM tracking
        WHERE id = ${input.trackingId}
        LIMIT 1
      `;

      const row = rows[0];
      return {
        kanbanCardBackgroundColor: row?.kanban_card_background_color ?? null,
        kanbanCardBorderColor: row?.kanban_card_border_color ?? null,
        kanbanCardBackgroundOpacity:
          row?.kanban_card_background_opacity ?? 100,
        kanbanColumnBackgroundColor:
          row?.kanban_column_background_color ?? null,
        kanbanColumnBorderColor: row?.kanban_column_border_color ?? null,
        kanbanColumnBackgroundOpacity:
          row?.kanban_column_background_opacity ?? 100,
        kanbanBackgroundColor: row?.kanban_background_color ?? null,
        kanbanBackgroundImage: row?.kanban_background_image ?? null,
        kanbanBackgroundBlur: row?.kanban_background_blur ?? 0,
        kanbanBackgroundOpacity: row?.kanban_background_opacity ?? 50,
      };
    } catch (e) {
      console.warn(
        "[tracking.getKanbanAppearance] columns missing — run pnpm db:migrate",
        e,
      );
      return {
        kanbanCardBackgroundColor: null,
        kanbanCardBorderColor: null,
        kanbanCardBackgroundOpacity: 100,
        kanbanColumnBackgroundColor: null,
        kanbanColumnBorderColor: null,
        kanbanColumnBackgroundOpacity: 100,
        kanbanBackgroundColor: null,
        kanbanBackgroundImage: null,
        kanbanBackgroundBlur: 0,
        kanbanBackgroundOpacity: 50,
      };
    }
  });
