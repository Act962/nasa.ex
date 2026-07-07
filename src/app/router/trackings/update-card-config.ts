import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";

const fieldSchema = z.object({
  key: z.string(),
  label: z.string(),
  type: z.enum(["lead", "form", "custom"]),
  formFieldId: z.string().optional(),
  formId: z.string().optional(),
});

export const updateTrackingCardConfig = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "PUT",
    summary: "Update card config of a tracking",
    tags: ["Trackings"],
  })
  .input(
    z.object({
      trackingId: z.string(),
      fields: z.array(fieldSchema),
      // Visibilidade de campos do card/coluna (mapa fieldId → boolean).
      cardVisibility: z.record(z.string(), z.boolean()).optional(),
      showSlaTimer: z.boolean().optional(),
      // Cesta de compra (novo): visibilidade + 3 thresholds em dias
      showPurchaseBasket: z.boolean().optional(),
      basketRecentDays: z.number().int().min(1).max(3650).optional(),
      basketMediumDays: z.number().int().min(1).max(3650).optional(),
      basketLongDays: z.number().int().min(1).max(3650).optional(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    try {
      // Permissão: só o Owner do tracking (TrackingParticipant OWNER) ou
      // Owner/Admin da MESMA organização do tracking podem personalizar o board.
      const userId = context.user.id;

      // Tenant scoping: o papel de admin/owner precisa ser na organização DONA
      // do tracking (não na org ativa do caller) — senão um admin da org A
      // conseguiria editar um tracking da org B (IDOR).
      const tracking = await prisma.tracking.findUnique({
        where: { id: input.trackingId },
        select: { organizationId: true },
      });
      if (!tracking) {
        throw errors.NOT_FOUND({ message: "Tracking não encontrado." });
      }

      const membership = await prisma.member.findFirst({
        where: { organizationId: tracking.organizationId, userId },
        select: { role: true },
      });
      const isOrgAdmin =
        membership?.role === "owner" || membership?.role === "admin";

      let isTrackingOwner = false;
      if (!isOrgAdmin) {
        const participant = await prisma.trackingParticipant.findFirst({
          where: { trackingId: input.trackingId, userId, role: "OWNER" },
          select: { id: true },
        });
        isTrackingOwner = !!participant;
      }

      if (!isOrgAdmin && !isTrackingOwner) {
        throw errors.FORBIDDEN({
          message:
            "Apenas o Owner do tracking ou Owner/Admin da organização podem personalizar o board.",
        });
      }

      // Colunas já conhecidas pelo client antes desta migration → upsert tipado
      // é seguro mesmo com client em cache (stale). `cardVisibility` (coluna
      // nova) é escrita à parte via raw, pelo mesmo motivo do $queryRaw em
      // getCardConfig.
      const data = {
        fields: input.fields,
        ...(input.showSlaTimer !== undefined && { showSlaTimer: input.showSlaTimer }),
        ...(input.showPurchaseBasket !== undefined && {
          showPurchaseBasket: input.showPurchaseBasket,
        }),
        ...(input.basketRecentDays !== undefined && {
          basketRecentDays: input.basketRecentDays,
        }),
        ...(input.basketMediumDays !== undefined && {
          basketMediumDays: input.basketMediumDays,
        }),
        ...(input.basketLongDays !== undefined && {
          basketLongDays: input.basketLongDays,
        }),
      };

      const config = await prisma.trackingCardConfig.upsert({
        where: { trackingId: input.trackingId },
        create: { trackingId: input.trackingId, ...data },
        update: data,
      });

      if (input.cardVisibility !== undefined) {
        await prisma.$executeRaw`
          UPDATE tracking_card_config
          SET card_visibility = ${JSON.stringify(input.cardVisibility)}::jsonb
          WHERE tracking_id = ${input.trackingId}
        `;
      }

      return { config };
    } catch (err) {
      // Repassa erros oRPC (ex.: FORBIDDEN) sem transformar em 500. Prisma
      // também expõe `code` (P2xxx), por isso checamos os códigos oRPC.
      const code = (err as { code?: string } | null)?.code;
      if (code === "FORBIDDEN" || code === "UNAUTHORIZED" || code === "NOT_FOUND") {
        throw err;
      }
      console.error(err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
