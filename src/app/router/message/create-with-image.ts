import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import {
  CreatedMessageProps,
  MessageStatus,
} from "@/features/tracking-chat/types";
import { useConstructUrl } from "@/hooks/use-construct-url";
import { sendMedia } from "@/http/uazapi/send-media";
import prisma from "@/lib/prisma";
import { pusherServer } from "@/lib/pusher";
import z from "zod";

export const createMessageWithImage = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    path: "/message/create-with-image",
    summary: "Create message with image",
  })
  .input(
    z.object({
      conversationId: z.string(),
      body: z.string().optional(),
      leadPhone: z.string(),
      token: z.string(),
      mediaUrl: z.string(),
    }),
  )
  .handler(async ({ input, context }) => {
    try {
      const response = await sendMedia(input.token, {
        file: useConstructUrl(input.mediaUrl),
        text: input.body,
        number: input.leadPhone,
        delay: 2000,
        type: "image",
        readchat: true,
        readmessages: true,
      });

      const message = await prisma.message.create({
        data: {
          conversationId: input.conversationId,
          body: input.body,
          mediaUrl: input.mediaUrl,
          mimetype: "image/jpeg",
          messageId: response.id,
          fromMe: true,
          status: MessageStatus.SENT,
        },
        include: {
          conversation: {
            include: {
              lead: true,
            },
          },
        },
      });
      const messageCreated: CreatedMessageProps = {
        ...message,
        currentUserId: context.user.id,
      };
      await pusherServer.trigger(
        message.conversationId,
        "message:created",
        messageCreated,
      );

      return {
        message: {
          id: message.id,
          body: message.body,
          createdAt: message.createdAt,
          fromMe: true,
          mediaUrl: message.mediaUrl,
          mimetype: message.mimetype,
          status: message.status,
          conversation: {
            lead: {
              id: message.conversation.lead.id,
              name: message.conversation.lead.name,
            },
          },
        },
      };
    } catch (e) {
      console.log(e);
      throw e;
    }
  });
