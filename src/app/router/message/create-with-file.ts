import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import {
  CreatedMessageProps,
  MessageStatus,
} from "@/features/tracking-chat/types";
import { useConstructUrl } from "@/hooks/use-construct-url";
import { markReadMessage } from "@/http/uazapi/mark-read-message";
import { sendMedia } from "@/http/uazapi/send-media";
import prisma from "@/lib/prisma";
import { pusherServer } from "@/lib/pusher";
import z from "zod";
import {
  attendLeadIfWaiting,
  updateConversationLastMessage,
  claimLeadForAttendant,
  logChatMessageSent,
  triggerFirstChatInteractionIfFirst,
} from "./utils";
import { MessageChannel } from "@/generated/prisma/enums";
import { chargeMessageOutbound } from "@/features/stars/lib/charge-message-outbound";

export const createMessageWithFile = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    path: "/message/create-with-file",
    summary: "Create message with file",
  })
  .input(
    z.object({
      conversationId: z.string(),
      body: z.string().optional(),
      leadPhone: z.string(),
      token: z.string(),
      mediaUrl: z.string(),
      fileName: z.string(),
      mimetype: z.string(),
      id: z.string().optional(),
      quotedMessageId: z.string().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    try {
      // Cobra 1★ antes de chamar uazapi — evita custo de API sem saldo.
      const conv = await prisma.conversation.findUnique({
        where: { id: input.conversationId },
        select: { channel: true, tracking: { select: { organizationId: true } } },
      });
      if (conv?.tracking?.organizationId) {
        await chargeMessageOutbound({
          organizationId: conv.tracking.organizationId,
          userId: context.user.id,
          channel:
            conv.channel === MessageChannel.INSTAGRAM
              ? "instagram"
              : conv.channel === MessageChannel.FACEBOOK
                ? "facebook"
                : "whatsapp",
          mediaType: "file",
        });
      }

      console.log(input);
      const response = await sendMedia(input.token, {
        file: useConstructUrl(input.mediaUrl),
        text: input.body,
        docName: input.fileName,
        number: input.leadPhone,

        type: "document",
        readchat: true,
        readmessages: true,
        replyid: input.quotedMessageId,
      });

      const message = await prisma.message.create({
        data: {
          conversationId: input.conversationId,
          body: input.body,
          mediaUrl: input.mediaUrl,
          mimetype: input.mimetype,
          messageId: response.id,
          fromMe: true,
          fileName: input.fileName,
          status: MessageStatus.SENT,
          quotedMessageId: input.id,
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
              channel: true,
              tracking: { select: { organizationId: true } },
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
      await updateConversationLastMessage(message.conversationId, message.id, message.createdAt);
      await claimLeadForAttendant(message.conversation.lead.id, context.user.id);

      await triggerFirstChatInteractionIfFirst({
        conversationId: input.conversationId,
        leadId: message.conversation.lead.id,
      });

      await logChatMessageSent({
        organizationId: message.conversation.tracking?.organizationId,
        conversationId: input.conversationId,
        channel: message.conversation.channel ?? MessageChannel.WHATSAPP,
        user: { id: context.user.id, name: context.user.name, email: context.user.email, image: (context.user as any).image },
        messageId: message.id,
        body: input.body ?? "",
        mediaType: "file",
        leadId: message.conversation.lead.id,
        leadName: message.conversation.lead.name,
      });

      return {
        message: {
          id: message.id,
          body: message.body,
          createdAt: message.createdAt,
          fromMe: true,
          mediaUrl: message.mediaUrl,
          mimetype: message.mimetype,
          fileName: message.fileName,
          status: message.status,
          messageId: message.messageId,
          quotedMessageId: message.quotedMessageId,
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
