import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import {
  CreatedMessageProps,
  MessageStatus,
} from "@/features/tracking-chat/types";
import { markReadMessage } from "@/http/uazapi/mark-read-message";
import { sendText } from "@/http/uazapi/send-text";
import prisma from "@/lib/prisma";
import { pusherServer } from "@/lib/pusher";
import z from "zod";

export const createTextMessage = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    path: "/message/create",
    summary: "Create message",
  })
  .input(
    z.object({
      conversationId: z.string(),
      body: z.string(),
      leadPhone: z.string(),
      token: z.string(),
      mediaUrl: z.string().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    try {
      const response = await sendText(input.token, {
        text: input.body,
        number: input.leadPhone,
        delay: 2000,
      });

      await markReadMessage(input.token, {
        number: response.chatid,
        read: true,
      });

      const message = await prisma.message.create({
        data: {
          conversationId: input.conversationId,
          body: input.body,
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
          mediaUrl: null,
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
