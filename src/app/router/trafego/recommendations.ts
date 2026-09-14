import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import {
  buildTrafegoRecommendations,
  type TrafegoRecommendations,
} from "@/features/trafego/server/lib/recommendations";

/**
 * Recomendações do pedido. Gera na primeira leitura e quando o cliente pede de
 * novo — não há cron: o dado só interessa enquanto ele está olhando a tela.
 */
export const getTrafegoRecommendations = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ orderId: z.string().min(1), refresh: z.boolean().default(false) }))
  .handler(async ({ input, context }) => {
    const order = await prisma.trafegoOrder.findFirst({
      where: { id: input.orderId, organizationId: context.org.id },
      select: { id: true, recommendations: true, recommendationsGeneratedAt: true },
    });
    if (!order) {
      throw new ORPCError("NOT_FOUND", { message: "Campanha não encontrada." });
    }

    if (!input.refresh && order.recommendations) {
      return order.recommendations as unknown as TrafegoRecommendations;
    }

    const recommendations = await buildTrafegoRecommendations(order.id);
    if (!recommendations) {
      throw new ORPCError("NOT_FOUND", { message: "Campanha não encontrada." });
    }

    await prisma.trafegoOrder
      .update({
        where: { id: order.id },
        data: {
          recommendations: recommendations as unknown as object,
          recommendationsGeneratedAt: new Date(),
        },
      })
      .catch((error) => console.error("[trafego/recommendations] gravação falhou:", error));

    return recommendations;
  });
