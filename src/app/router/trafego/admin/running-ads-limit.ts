import { base } from "@/app/middlewares/base";
import { requireAdminMiddleware } from "@/app/middlewares/admin";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import prisma from "@/lib/prisma";

/** A equipe libera mais anúncios no ar depois de cobrar o extra (spec 0127, RF-6). */
export const setTrafegoRunningAdsLimit = base
  .use(requireAdminMiddleware)
  .input(z.object({ orderId: z.string().min(1), maxRunningAds: z.number().int().min(1).max(50) }))
  .handler(async ({ input, context }) => {
    const order = await prisma.trafegoOrder.findUnique({
      where: { id: input.orderId },
      select: { id: true, status: true, maxCreatives: true },
    });
    if (!order) throw new ORPCError("NOT_FOUND", { message: "Pedido não encontrado." });
    if (order.maxCreatives === input.maxRunningAds) return { success: true };

    await prisma.trafegoOrder.update({ where: { id: order.id }, data: { maxCreatives: input.maxRunningAds } });
    await prisma.trafegoOrderEvent.create({
      data: {
        orderId: order.id,
        fromStatus: order.status,
        toStatus: order.status,
        title: "Limite de anúncios alterado",
        detail: `De ${order.maxCreatives} para ${input.maxRunningAds} anúncios ao mesmo tempo.`,
        isClientVisible: true,
        actorUserId: context.adminUser.id,
        source: "ADMIN",
      },
    });
    return { success: true };
  });
