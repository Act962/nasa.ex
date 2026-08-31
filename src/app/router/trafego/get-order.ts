import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { getPublicMediaUrl } from "@/lib/r2-url";

/**
 * Detalhe do pedido para o painel do cliente.
 *
 * Filtra eventos por `isClientVisible` — notas internas da equipe não vazam.
 * As keys do R2 viram URL aqui; o banco guarda sempre a key.
 */
export const getTrafegoOrder = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ orderId: z.string().min(1) }))
  .handler(async ({ input, context }) => {
    const order = await prisma.trafegoOrder.findFirst({
      where: { id: input.orderId, organizationId: context.org.id },
      select: {
        id: true,
        code: true,
        planNameSnapshot: true,
        platform: true,
        campaignType: true,
        objective: true,
        status: true,
        durationDays: true,
        maxCreatives: true,
        maxCopies: true,
        adBudgetBrlCents: true,
        serviceFeeBrlCents: true,
        totalBrlCents: true,
        businessName: true,
        businessNiche: true,
        targetAudience: true,
        destinationUrl: true,
        whatsappNumber: true,
        notes: true,
        createdAt: true,
        requestedAt: true,
        approvedAt: true,
        startedAt: true,
        endsAt: true,
        completedAt: true,
        metaCampaignExternalId: true,
        broadcastId: true,
        creatives: {
          orderBy: { position: "asc" },
          select: {
            id: true,
            kind: true,
            fileKey: true,
            fileName: true,
            fileSize: true,
            mimeType: true,
            width: true,
            height: true,
            durationSeconds: true,
            position: true,
            status: true,
            reviewNote: true,
            createdAt: true,
          },
        },
        copies: {
          orderBy: { position: "asc" },
          select: {
            id: true,
            headline: true,
            primaryText: true,
            description: true,
            callToAction: true,
            source: true,
            isSelected: true,
            position: true,
          },
        },
        events: {
          where: { isClientVisible: true },
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            fromStatus: true,
            toStatus: true,
            title: true,
            detail: true,
            createdAt: true,
          },
        },
      },
    });

    if (!order) {
      throw new ORPCError("NOT_FOUND", { message: "Campanha não encontrada." });
    }

    const creatives = await Promise.all(
      order.creatives.map(async (creative) => ({
        ...creative,
        url: await getPublicMediaUrl(creative.fileKey),
      })),
    );

    return { ...order, creatives };
  });
