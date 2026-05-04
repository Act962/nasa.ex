import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import z from "zod";
import { deleteMessage } from "@/http/uazapi/delete-message";
import { logActivity } from "@/lib/activity-logger";
import prisma from "@/lib/prisma";

export const deleteMessageHandler = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    path: "/message/delete",
    summary: "Delete message",
  })
  .input(
    z.object({
      id: z.string(),
      token: z.string(),
      messageId: z.string(),
    }),
  )
  .handler(async ({ input, context }) => {
    try {
      const messageBefore = await prisma.message.findUnique({
        where: { messageId: input.id },
        select: {
          id: true,
          body: true,
          conversationId: true,
          conversation: {
            select: {
              leadId: true,
              trackingId: true,
              tracking: { select: { organizationId: true } },
              lead: { select: { name: true } },
            },
          },
        },
      });

      const response = await deleteMessage({
        id: input.id,
        token: input.token,
      });

      if (!response) {
        throw new Error("Message not found");
      }

      await prisma.message.delete({
        where: {
          messageId: input.id,
        },
      });

      if (messageBefore?.conversation?.tracking?.organizationId) {
        const conv = messageBefore.conversation;
        await logActivity({
          organizationId: conv.tracking.organizationId,
          userId: context.user.id,
          userName: context.user.name,
          userEmail: context.user.email,
          userImage: (context.user as any).image,
          appSlug: "chat",
          subAppSlug: "tracking-chat",
          featureKey: "chat.message.deleted",
          action: "chat.message.deleted",
          actionLabel: `Excluiu mensagem do lead "${conv.lead?.name ?? "—"}"`,
          resource: conv.lead?.name ?? undefined,
          resourceId: messageBefore.id,
          metadata: {
            conversationId: conv.id,
            leadId: conv.leadId,
            trackingId: conv.trackingId,
            deletedBody: messageBefore.body ?? null,
          },
        });
      }
    } catch (e) {
      console.log(e);
      throw e;
    }
  });
