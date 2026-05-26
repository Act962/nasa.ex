import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import {
  CreatedMessageProps,
  MessageStatus,
} from "@/features/tracking-chat/types";
import { sendLocation } from "@/http/uazapi/send-location";
import prisma from "@/lib/prisma";
import { pusherServer } from "@/lib/pusher";
import { MessageChannel } from "@/generated/prisma/enums";
import z from "zod";
import {
  attendLeadIfWaiting,
  updateConversationLastMessage,
  claimLeadForAttendant,
  logChatMessageSent,
  triggerFirstChatInteractionIfFirst,
} from "./utils";
import { chargeMessageOutbound } from "@/features/stars/lib/charge-message-outbound";
import {
  shouldSkipUazapiForConversation,
  markInstanceConnectionFailure,
} from "@/features/tracking-chat/lib/in-chat-mode";
import { v4 as uuidv4 } from "uuid";

export const createLocationMessage = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    path: "/message/create-location",
    summary: "Create location message",
  })
  .input(
    z.object({
      conversationId: z.string(),
      leadPhone: z.string(),
      token: z.string(),
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
      name: z.string().optional(),
      address: z.string().optional(),
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

      // Cobra 1★ antes de chamar uazapi — evita custo de API sem saldo.
      if (organizationId) {
        await chargeMessageOutbound({
          organizationId,
          userId: context.user.id,
          channel:
            channel === MessageChannel.INSTAGRAM
              ? "instagram"
              : channel === MessageChannel.FACEBOOK
                ? "facebook"
                : "whatsapp",
          mediaType: "location",
        });
      }

      // ── In-Chat Fallback ─────────────────────────────────────────────
      const inChatMode =
        channel === MessageChannel.WHATSAPP &&
        (await shouldSkipUazapiForConversation(input.conversationId));

      let messageid = uuidv4();
      if (!inChatMode) {
        try {
          const response = await sendLocation(input.token, {
            number: input.leadPhone,
            latitude: input.latitude,
            longitude: input.longitude,
            name: input.name,
            address: input.address,
            replyid: input.replyId,
            readmessages: true,
            readchat: true,
          });
          messageid = response.messageid;
        } catch (err: any) {
          const msg = String(err?.message ?? "");
          const isLikelyBan =
            msg.includes("status 401") ||
            msg.includes("status 403") ||
            msg.includes("status 500") ||
            msg.toLowerCase().includes("invalid token") ||
            msg.toLowerCase().includes("timeout");
          if (isLikelyBan) {
            markInstanceConnectionFailure({
              apiKey: input.token,
              source: "send_failure",
            }).catch(() => {});
          }
          throw err;
        }
      }

      const bodyText =
        [input.name, input.address].filter(Boolean).join(" — ") || null;

      const message = await prisma.message.create({
        data: {
          conversationId: input.conversationId,
          body: bodyText,
          messageId: messageid,
          fromMe: true,
          status: MessageStatus.SENT,
          quotedMessageId: input.id,
          mediaType: "location",
          latitude: input.latitude,
          longitude: input.longitude,
          senderName: context.user.name,
          viaInChat: inChatMode,
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
      await updateConversationLastMessage(message.conversationId, message.id, message.createdAt);
      await claimLeadForAttendant(message.conversation.lead.id, context.user.id);

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
        body: bodyText ?? "",
        mediaType: "location" as any,
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
          latitude: message.latitude,
          longitude: message.longitude,
          mediaType: message.mediaType,
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
