import { base } from "@/app/middlewares/base";
import { requireAdminMiddleware } from "@/app/middlewares/admin";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { getPublicMediaUrl } from "@/lib/r2-url";
import {
  trafegoOrderStatusSchema,
  trafegoPlatformSchema,
} from "@/features/trafego/schema/trafego-schemas";
import { transitionTrafegoOrder } from "@/features/trafego/server/lib/transition-order";

const PAGE_SIZE = 30;

export const listTrafegoOrdersAdmin = base
  .use(requireAdminMiddleware)
  .input(
    z.object({
      status: trafegoOrderStatusSchema.optional(),
      platform: trafegoPlatformSchema.optional(),
      onlyMismatch: z.boolean().optional(),
      search: z.string().trim().max(120).optional(),
      page: z.number().int().min(1).default(1),
    }),
  )
  .handler(async ({ input }) => {
    const where = {
      ...(input.status ? { status: input.status } : {}),
      ...(input.platform ? { platform: input.platform } : {}),
      ...(input.onlyMismatch
        ? { pendingPurchase: { is: { amountMismatch: true } } }
        : {}),
      ...(input.search
        ? {
            OR: [
              { code: { contains: input.search, mode: "insensitive" as const } },
              { businessName: { contains: input.search, mode: "insensitive" as const } },
              { owner: { email: { contains: input.search, mode: "insensitive" as const } } },
            ],
          }
        : {}),
    };

    const [orders, total] = await Promise.all([
      prisma.trafegoOrder.findMany({
        where,
        orderBy: [{ requestedAt: "desc" }, { createdAt: "desc" }],
        skip: (input.page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: {
          id: true,
          code: true,
          status: true,
          platform: true,
          objective: true,
          planNameSnapshot: true,
          businessName: true,
          adBudgetBrlCents: true,
          serviceFeeBrlCents: true,
          totalBrlCents: true,
          createdAt: true,
          requestedAt: true,
          metaCampaignExternalId: true,
          broadcastId: true,
          organization: { select: { id: true, name: true, slug: true } },
          owner: { select: { id: true, name: true, email: true } },
          assignedTo: { select: { id: true, name: true } },
          pendingPurchase: { select: { amountMismatch: true } },
          _count: { select: { creatives: true, copies: true, messages: true } },
        },
      }),
      prisma.trafegoOrder.count({ where }),
    ]);

    return {
      orders: orders.map((order) => ({
        ...order,
        amountMismatch: order.pendingPurchase?.amountMismatch ?? false,
        creativesCount: order._count.creatives,
        copiesCount: order._count.copies,
        messagesCount: order._count.messages,
      })),
      total,
      page: input.page,
      pageSize: PAGE_SIZE,
    };
  });

export const getTrafegoOrderAdmin = base
  .use(requireAdminMiddleware)
  .input(z.object({ orderId: z.string().min(1) }))
  .handler(async ({ input }) => {
    const order = await prisma.trafegoOrder.findUnique({
      where: { id: input.orderId },
      include: {
        organization: { select: { id: true, name: true, slug: true } },
        owner: { select: { id: true, name: true, email: true, phone: true } },
        assignedTo: { select: { id: true, name: true } },
        pendingPurchase: {
          select: {
            amountMismatch: true,
            amountBrlCents: true,
            paidAt: true,
            stripeSessionId: true,
          },
        },
        creatives: { orderBy: { position: "asc" } },
        copies: { orderBy: { position: "asc" } },
        events: { orderBy: { createdAt: "asc" } },
      },
    });

    if (!order) {
      throw new ORPCError("NOT_FOUND", { message: "Pedido não encontrado." });
    }

    const creatives = await Promise.all(
      order.creatives.map(async (creative) => ({
        ...creative,
        url: await getPublicMediaUrl(creative.fileKey),
      })),
    );

    return { ...order, creatives };
  });

export const updateTrafegoOrderStatus = base
  .use(requireAdminMiddleware)
  .input(
    z.object({
      orderId: z.string().min(1),
      status: trafegoOrderStatusSchema,
      clientNote: z.string().trim().max(2000).optional(),
      internalNote: z.string().trim().max(2000).optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const result = await transitionTrafegoOrder({
      orderId: input.orderId,
      toStatus: input.status,
      source: "ADMIN",
      actorUserId: context.adminUser.id,
      clientNote: input.clientNote || null,
      internalNote: input.internalNote || null,
    });

    if (!result.changed) {
      if (result.reason === "not_found") {
        throw new ORPCError("NOT_FOUND", { message: "Pedido não encontrado." });
      }
      if (result.reason === "claim_failed") {
        throw new ORPCError("CONFLICT", {
          message: "O pedido mudou de status enquanto você editava. Recarregue a página.",
        });
      }
      return { success: true, unchanged: true };
    }

    return { success: true, unchanged: false };
  });

/** Desfaz o vínculo com a campanha do Meta (manual ou automático). */
export const unlinkTrafegoMetaCampaign = base
  .use(requireAdminMiddleware)
  .input(z.object({ orderId: z.string().min(1) }))
  .handler(async ({ input, context }) => {
    const order = await prisma.trafegoOrder.findUnique({
      where: { id: input.orderId },
      select: { id: true, status: true, metaCampaignExternalId: true },
    });
    if (!order) {
      throw new ORPCError("NOT_FOUND", { message: "Pedido não encontrado." });
    }

    await prisma.$transaction([
      prisma.trafegoOrder.update({
        where: { id: order.id },
        data: { metaCampaignExternalId: null, metaAdCampaignId: null },
      }),
      prisma.trafegoOrderEvent.create({
        data: {
          orderId: order.id,
          fromStatus: order.status,
          toStatus: order.status,
          title: "Campanha do Meta desvinculada",
          detail: order.metaCampaignExternalId
            ? `Vínculo anterior: ${order.metaCampaignExternalId}`
            : null,
          isClientVisible: false,
          actorUserId: context.adminUser.id,
          source: "ADMIN",
        },
      }),
    ]);

    return { success: true };
  });

export const assignTrafegoOrder = base
  .use(requireAdminMiddleware)
  .input(
    z.object({
      orderId: z.string().min(1),
      assignedToUserId: z.string().min(1).nullable(),
    }),
  )
  .handler(async ({ input }) => {
    await prisma.trafegoOrder.update({
      where: { id: input.orderId },
      data: { assignedToUserId: input.assignedToUserId },
    });
    return { success: true };
  });

/**
 * Vincula a campanha real do Meta ao pedido. `metricsOrganizationId` é
 * obrigatório na prática: sem ele o painel do cliente não acha os snapshots,
 * porque eles nascem na org da agência. Quando não vem no input, cai no
 * `TrafegoSettings.agencyOrganizationId`.
 */
export const linkTrafegoMetaCampaign = base
  .use(requireAdminMiddleware)
  .input(
    z.object({
      orderId: z.string().min(1),
      metaCampaignExternalId: z.string().trim().min(1).nullable(),
      metricsOrganizationId: z.string().min(1).optional(),
    }),
  )
  .handler(async ({ input }) => {
    let metricsOrganizationId = input.metricsOrganizationId ?? null;

    if (input.metaCampaignExternalId && !metricsOrganizationId) {
      const settings = await prisma.trafegoSettings.findUnique({
        where: { id: "singleton" },
        select: { agencyOrganizationId: true },
      });
      metricsOrganizationId = settings?.agencyOrganizationId ?? null;
      if (!metricsOrganizationId) {
        throw new ORPCError("BAD_REQUEST", {
          message:
            "Configure a organização da agência em Ajustes do trafeGO antes de vincular — sem ela o cliente não vê métricas.",
        });
      }
    }

    // Espelho local, quando a campanha já foi sincronizada por metaAds.
    const localCampaign = input.metaCampaignExternalId
      ? await prisma.metaAdCampaign.findUnique({
          where: { metaCampaignId: input.metaCampaignExternalId },
          select: { id: true },
        })
      : null;

    await prisma.trafegoOrder.update({
      where: { id: input.orderId },
      data: {
        metaCampaignExternalId: input.metaCampaignExternalId,
        metricsOrganizationId,
        metaAdCampaignId: localCampaign?.id ?? null,
      },
    });

    return { success: true, linkedLocalCampaign: Boolean(localCampaign) };
  });

export const linkTrafegoBroadcast = base
  .use(requireAdminMiddleware)
  .input(
    z.object({
      orderId: z.string().min(1),
      broadcastId: z.string().min(1).nullable(),
    }),
  )
  .handler(async ({ input }) => {
    if (input.broadcastId) {
      const taken = await prisma.trafegoOrder.findFirst({
        where: { broadcastId: input.broadcastId, id: { not: input.orderId } },
        select: { code: true },
      });
      if (taken) {
        throw new ORPCError("BAD_REQUEST", {
          message: `Este disparo já está vinculado ao pedido ${taken.code}.`,
        });
      }
    }

    await prisma.trafegoOrder.update({
      where: { id: input.orderId },
      data: { broadcastId: input.broadcastId },
    });
    return { success: true };
  });

export const reviewTrafegoCreative = base
  .use(requireAdminMiddleware)
  .input(
    z.object({
      creativeId: z.string().min(1),
      status: z.enum(["UPLOADED", "SELECTED", "REJECTED"]),
      reviewNote: z.string().trim().max(1000).optional(),
    }),
  )
  .handler(async ({ input }) => {
    await prisma.trafegoCreative.update({
      where: { id: input.creativeId },
      data: { status: input.status, reviewNote: input.reviewNote ?? null },
    });
    return { success: true };
  });

export const replyTrafegoMessageAdmin = base
  .use(requireAdminMiddleware)
  .input(
    z.object({
      orderId: z.string().min(1),
      body: z.string().trim().min(1).max(4000),
      attachmentKey: z.string().max(500).optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    return prisma.trafegoSupportMessage.create({
      data: {
        orderId: input.orderId,
        authorUserId: context.adminUser.id,
        authorRole: "ÓRBITA",
        body: input.body,
        attachmentKey: input.attachmentKey,
        readByNasaAt: new Date(),
      },
      select: { id: true, createdAt: true },
    });
  });

export const listTrafegoMessagesAdmin = base
  .use(requireAdminMiddleware)
  .input(z.object({ orderId: z.string().min(1) }))
  .handler(async ({ input }) => {
    return prisma.trafegoSupportMessage.findMany({
      where: { orderId: input.orderId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        body: true,
        authorRole: true,
        attachmentKey: true,
        createdAt: true,
        author: { select: { id: true, name: true, image: true } },
      },
    });
  });
