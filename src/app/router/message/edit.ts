import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import z from "zod";
import { editMessage } from "@/http/uazapi/edit-message";
import { logActivity } from "@/lib/activity-logger";
import prisma from "@/lib/prisma";
import { MessageStatus } from "@/generated/prisma/enums";

export const editMessageHandler = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    path: "/message/edit",
    summary: "Edit message",
  })
  .input(
    z.object({
      id: z.string(),
      text: z.string(),
      token: z.string(),
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
              tracking: { select: { organizationId: true, name: true } },
              lead: { select: { name: true } },
            },
          },
        },
      });

      const response = await editMessage({
        data: {
          id: input.id,
          text: input.text,
        },
        token: input.token,
      });

      if (!response) {
        throw new Error("Failed to edit message or message not found");
      }

      await prisma.message.update({
        where: {
          messageId: input.id,
        },
        data: {
          body: response.content.text,
          messageId: response.messageid,
          status: MessageStatus.SEEN,
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
          featureKey: "chat.message.edited",
          action: "chat.message.edited",
          actionLabel: `Editou mensagem do lead "${conv.lead?.name ?? "—"}"`,
          resource: conv.lead?.name ?? undefined,
          resourceId: messageBefore.id,
          metadata: {
            conversationId: conv.id,
            leadId: conv.leadId,
            trackingId: conv.trackingId,
            previousBody: messageBefore.body ?? null,
            newBody: response.content.text,
          },
        });
      }

      return response;
    } catch (e) {
      console.error("Error editing message:", e);
      throw e;
    }
  });
