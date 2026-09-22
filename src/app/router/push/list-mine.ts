import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

/**
 * Inscrições do próprio usuário, para a tela de ajustes mostrar em quantos
 * dispositivos o push está ligado. Nunca devolve `p256dh`/`auth`: são segredos
 * de criptografia e não têm uso no client.
 */
export const listMyPushSubscriptions = base
  .use(requiredAuthMiddleware)
  .input(z.object({}).optional())
  .handler(async ({ context }) => {
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId: context.user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        endpoint: true,
        userAgent: true,
        createdAt: true,
        lastUsedAt: true,
      },
    });

    return { subscriptions };
  });
