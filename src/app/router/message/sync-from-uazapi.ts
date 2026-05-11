import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import z from "zod";

export const syncFromUazapi = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    path: "/message/sync-from-uazapi",
    summary: "Trigger uazapi message history sync for one or more conversations",
  })
  .input(
    z.object({
      conversationIds: z.array(z.string()).min(1).max(50),
    }),
  )
  .handler(async ({ input, context }) => {
    const convs = await prisma.conversation.findMany({
      where: { id: { in: input.conversationIds } },
      select: {
        id: true,
        trackingId: true,
        tracking: {
          select: {
            whatsappInstance: { select: { apiKey: true } },
          },
        },
      },
    });

    const eligible = convs.filter(
      (c) => c.tracking?.whatsappInstance?.apiKey,
    );

    if (eligible.length === 0) {
      throw new Error(
        "Nenhuma conversa elegível (instância da uazapi não conectada)",
      );
    }

    await inngest.send(
      eligible.map((c) => ({
        name: "chat/messages.sync",
        data: {
          conversationId: c.id,
          trackingId: c.trackingId,
          requestedBy: context.user.id,
        },
      })),
    );

    return {
      ok: true,
      queued: eligible.length,
      skipped: convs.length - eligible.length,
    };
  });
