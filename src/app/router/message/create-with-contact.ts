import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import {
  CreatedMessageProps,
  MessageStatus,
} from "@/features/tracking-chat/types";
import { sendContact } from "@/http/uazapi/send-contact";
import prisma from "@/lib/prisma";
import { pusherServer } from "@/lib/pusher";
import { MessageChannel } from "@/generated/prisma/enums";
import z from "zod";
import {
  attendLeadIfWaiting,
  logChatMessageSent,
  triggerFirstChatInteractionIfFirst,
} from "./utils";

export const createContactMessage = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    path: "/message/create-contact",
    summary: "Create contact message",
  })
  .input(
    z.object({
      conversationId: z.string(),
      leadPhone: z.string(),
      token: z.string(),
      contactName: z.string().min(1),
      contactPhone: z.string().min(1),
      replyId: z.string().optional(),
      id: z.string().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    try {
      const conversation = await prisma.conversation.findUnique({
        where: { id: input.conversationId },
        select: {
          channel: true,
          trackingId: true,
          tracking: { select: { organizationId: true } },
        },
      });

      const channel = conversation?.channel ?? MessageChannel.WHATSAPP;
      const organizationId = conversation?.tracking?.organizationId;

      const response = await sendContact(input.token, {
        number: input.leadPhone,
        fullName: input.contactName,
        phoneNumber: input.contactPhone,
        replyid: input.replyId,
        readmessages: true,
        readchat: true,
      });

      const messageid = response.messageid;

      const message = await prisma.message.create({
        data: {
          conversationId: input.conversationId,
          body: input.contactName,
          messageId: messageid,
          fromMe: true,
          status: MessageStatus.SENT,
          quotedMessageId: input.id,
          mediaType: "contact",
          fileName: input.contactPhone,
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
          latitude: true,
          longitude: true,
          quotedMessageId: true,
          conversationId: true,
          senderId: true,
          senderName: true,
          conversation: {
            select: {
              id: true,
              lead: { select: { id: true, name: true } },
            },
          },
          quotedMessage: {
            include: {
              conversation: { include: { lead: true } },
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

      await attendLeadIfWaiting(message.conversation.lead.id, context.user.id);

      await triggerFirstChatInteractionIfFirst({
        conversationId: input.conversationId,
        leadId: message.conversation.lead.id,
      });

      await logChatMessageSent({
        organizationId,
        conversationId: input.conversationId,
        channel,
        user: {
          id: context.user.id,
          name: context.user.name,
          email: context.user.email,
          image: (context.user as any).image,
        },
        messageId: message.id,
        body: `${input.contactName} — ${input.contactPhone}`,
        mediaType: "contact" as any,
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
          mediaType: message.mediaType,
          fileName: message.fileName,
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
