import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

/** Pedidos da organização ativa — lista do painel do cliente. */
export const listTrafegoOrders = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({}).optional())
  .handler(async ({ context }) => {
    const orders = await prisma.trafegoOrder.findMany({
      where: { organizationId: context.org.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        code: true,
        planNameSnapshot: true,
        platform: true,
        campaignType: true,
        objective: true,
        status: true,
        adBudgetBrlCents: true,
        serviceFeeBrlCents: true,
        totalBrlCents: true,
        durationDays: true,
        maxCreatives: true,
        maxCopies: true,
        createdAt: true,
        startedAt: true,
        endsAt: true,
        metaCampaignExternalId: true,
        broadcastId: true,
        _count: { select: { creatives: true, copies: true } },
      },
    });

    return orders.map((order) => ({
      ...order,
      creativesCount: order._count.creatives,
      copiesCount: order._count.copies,
      hasMetricsLink: Boolean(order.metaCampaignExternalId || order.broadcastId),
      _count: undefined,
    }));
  });
