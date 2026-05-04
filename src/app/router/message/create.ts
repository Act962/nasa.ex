import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import {
  CreatedMessageProps,
  MessageStatus,
} from "@/features/tracking-chat/types";
import { markReadMessage } from "@/http/uazapi/mark-read-message";
import { sendText } from "@/http/uazapi/send-text";
import { sendInstagramDm } from "@/http/meta/send-instagram-dm";
import { sendFacebookMessage } from "@/http/meta/send-facebook-message";
import prisma from "@/lib/prisma";
import { pusherServer } from "@/lib/pusher";
import { IntegrationPlatform, MessageChannel } from "@/generated/prisma/enums";
import z from "zod";
import { v4 as uuidv4 } from "uuid";
import { attendLeadIfWaiting, logChatMessageSent } from "./utils";

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
      replyId: z.string().optional(),
      replyIdInternal: z.string().optional(),
      id: z.string().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    try {
      const conversation = await prisma.conversation.findUnique({
        where: { id: input.conversationId },
        select: { channel: true, trackingId: true, tracking: { select: { organizationId: true } } },
      });

      const channel = conversation?.channel ?? MessageChannel.WHATSAPP;
      const organizationId = conversation?.tracking?.organizationId;

      let externalMessageId = uuidv4();

      if (channel === MessageChannel.INSTAGRAM) {
        const integration = await prisma.platformIntegration.findFirst({
          where: { platform: IntegrationPlatform.INSTAGRAM, organizationId, isActive: true },
        });
        const config = integration?.config as Record<string, string> | null;
        if (config?.access_token) {
          const result = await sendInstagramDm({
            accessToken: config.access_token,
            recipientId: input.leadPhone,
            text: input.body,
          });
          if (result?.message_id) externalMessageId = result.message_id;
        }
      } else if (channel === MessageChannel.FACEBOOK) {
        const integration = await prisma.platformIntegration.findFirst({
          where: { platform: IntegrationPlatform.META, organizationId, isActive: true },
        });
        const config = integration?.config as Record<string, string> | null;
        if (config?.page_access_token && config?.page_id) {
          const result = await sendFacebookMessage({
            pageId: config.page_id,
            pageAccessToken: config.page_access_token,
            recipientId: input.leadPhone,
            text: input.body,
          });
          if (result?.message_id) externalMessageId = result.message_id;
        }
      } else {
        const response = await sendText(input.token, {
          text: input.body,
          number: input.leadPhone,
          replyid: input.replyId,
          readmessages: true,
          readchat: true,
        });
        externalMessageId = response.messageid;
      }

      // Kept for backwards compat — WhatsApp path used response.messageid above
      const messageid = externalMessageId;

      const message = await prisma.message.create({
        data: {
          conversationId: input.conversationId,
          body: input.body,
          messageId: messageid,
          fromMe: true,
          status: MessageStatus.SENT,
          quotedMessageId: input.id,
          mimetype: input.mediaUrl ? "image/jpeg" : null,
          senderName: context.user.name,
        },
        select: {
          id: true,
          messageId: true,
          body: true,
          createdAt: true,
          fromMe: true,
          status: true,
          mediaUrl: true,
          mediaType: true,
          mediaCaption: true,
          mimetype: true,
          fileName: true,
          quotedMessageId: true,
          conversationId: true,
          senderId: true,
          senderName: true,
          conversation: {
            select: {
              id: true,
              lead: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          quotedMessage: {
            include: {
              conversation: {
                include: {
                  lead: true,
                },
              },
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

      // Trigger gamification/attendance logic
      await attendLeadIfWaiting(message.conversation.lead.id, context.user.id);

      await logChatMessageSent({
        organizationId,
        conversationId: input.conversationId,
        channel,
        user: { id: context.user.id, name: context.user.name, email: context.user.email, image: (context.user as any).image },
        messageId: message.id,
        body: input.body,
        mediaType: "text",
        leadId: message.conversation.lead.id,
        leadName: message.conversation.lead.name,
      });

      return {
        message: {
          id: message.id,
          body: message.body,
          createdAt: message.createdAt,
          fromMe: true,
          messageId: message.messageId,
          mediaUrl: null,
          status: message.status,
          quotedMessage: message.quotedMessage,
          senderName: message.senderName,
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
