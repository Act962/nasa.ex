import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";
import { pusherServer } from "@/lib/pusher";
import { z } from "zod";

/**
 * Marca um alerta crítico como confirmado pelo usuário ("Entendi").
 *
 * Upsert em AdminNotificationRead setando readAt + acknowledgedAt.
 * Idempotente — chamar 2x não falha.
 *
 * Publica Pusher `alert:acked` no canal do user pra sincronizar multi-tab
 * (popup fecha em todas as abas sem cada uma chamar ack de novo).
 */
export const acknowledgeAlert = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    path: "/alerts/acknowledge",
    summary: "Confirma um alerta crítico (popup ✕)",
  })
  .input(z.object({ notificationId: z.string().min(1) }))
  .output(z.object({ success: z.literal(true) }))
  .handler(async ({ input, context }) => {
    const userId = context.user.id;
    const now = new Date();

    await prisma.adminNotificationRead.upsert({
      where: {
        notificationId_userId: {
          notificationId: input.notificationId,
          userId,
        },
      },
      create: {
        notificationId: input.notificationId,
        userId,
        readAt: now,
        acknowledgedAt: now,
      },
      update: {
        acknowledgedAt: now,
      },
    });

    // Sincroniza multi-tab — abas que ainda têm popup aberto fecham.
    try {
      await pusherServer.trigger(`private-user-${userId}`, "alert:acked", {
        notificationId: input.notificationId,
      });
    } catch (err) {
      console.error("[alerts] pusher acked falhou:", err);
    }

    return { success: true as const };
  });
