/**
 * Envio de vídeo (spec 0004). Hoje a única origem é um Script com vídeo
 * anexado — o composer não expõe upload de vídeo avulso.
 *
 * O binário nunca trafega por aqui: mandamos ao provider a URL pública do
 * objeto já armazenado, que é o que mantém o storage em O(scripts com
 * vídeo) em vez de O(envios).
 *
 * Não cobra ★ nesta fase (spec 0004, D-6 / P-1).
 */

import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import {
  CreatedMessageProps,
  MessageStatus,
} from "@/features/tracking-chat/types";
import prisma from "@/lib/prisma";
import { pusherServer } from "@/lib/pusher";
import { getPublicMediaUrl } from "@/lib/r2-url";
import { MessageChannel } from "@/generated/prisma/enums";
import {
  markInstanceConnectionFailure,
  shouldSkipUazapiForConversation,
} from "@/features/tracking-chat/lib/in-chat-mode";
import { resolveOutboundProvider } from "@/features/tracking-chat/lib/providers";
import { v4 as uuidv4 } from "uuid";
import z from "zod";
import {
  attendLeadIfWaiting,
  claimLeadForAttendant,
  logChatMessageSent,
  triggerFirstChatInteractionIfFirst,
  updateConversationLastMessage,
} from "./utils";

export const createVideoMessage = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    path: "/message/create-with-video",
    summary: "Create message with video",
  })
  .input(
    z.object({
      conversationId: z.string(),
      leadPhone: z.string(),
      /** Key do objeto no R2 (`videos/scripts/...`). */
      mediaUrl: z.string().min(1),
      mimetype: z.string().min(1),
      fileName: z.string().min(1),
      /** Legenda — o conteúdo do script já com as variáveis resolvidas. */
      body: z.string().optional(),
      quotedMessageId: z.string().optional(),
      id: z.string().optional(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const conversation = await prisma.conversation.findUnique({
      where: { id: input.conversationId },
      select: {
        channel: true,
        trackingId: true,
        tracking: { select: { organizationId: true } },
      },
    });

    const channel = conversation?.channel ?? MessageChannel.WHATSAPP;
    if (channel !== MessageChannel.WHATSAPP) {
      throw errors.BAD_REQUEST({
        message: "Envio de vídeo disponível apenas no canal WhatsApp.",
      });
    }

    const inChatMode = await shouldSkipUazapiForConversation(
      input.conversationId,
    );

    let externalMessageId = uuidv4();

    if (!inChatMode) {
      if (!conversation?.trackingId) {
        throw new Error(
          "Conversation sem trackingId — não é possível resolver provider.",
        );
      }
      const resolved = await resolveOutboundProvider(conversation.trackingId);
      // URL absoluta e pública — a Uazapi/Meta baixa o arquivo por conta
      // própria. `getPublicMediaUrl` cai em presigned quando não há domínio
      // público configurado (spec 0004, CB-4/CB-5).
      const publicUrl = await getPublicMediaUrl(input.mediaUrl);

      try {
        const response = await resolved.provider.sendMedia({
          kind: "media",
          mediaKind: "video",
          to: input.leadPhone,
          mediaUrl: publicUrl,
          caption: input.body,
          fileName: input.fileName,
          mimetype: input.mimetype,
          replyToExternalMessageId: input.quotedMessageId,
        });
        externalMessageId = response.externalMessageId;
      } catch (err) {
        const message = String((err as { message?: string })?.message ?? "");
        if (resolved.providerId === "uazapi" && resolved.uazapiToken) {
          const isLikelyBan =
            message.includes("status 401") ||
            message.includes("status 403") ||
            message.includes("status 500") ||
            message.toLowerCase().includes("invalid token") ||
            message.toLowerCase().includes("timeout");
          if (isLikelyBan) {
            markInstanceConnectionFailure({
              apiKey: resolved.uazapiToken,
              source: "send_failure",
            }).catch(() => {});
          }
        }
        throw err;
      }
    }

    const message = await prisma.message.create({
      data: {
        conversationId: input.conversationId,
        body: input.body,
        mediaUrl: input.mediaUrl,
        mediaType: "video",
        mimetype: input.mimetype,
        fileName: input.fileName,
        messageId: externalMessageId,
        fromMe: true,
        status: MessageStatus.SENT,
        quotedMessageId: input.id,
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
        quotedMessageId: true,
        conversationId: true,
        senderId: true,
        senderName: true,
        conversation: {
          select: {
            id: true,
            channel: true,
            tracking: { select: { organizationId: true } },
            lead: { select: { id: true, name: true } },
          },
        },
        quotedMessage: {
          include: { conversation: { include: { lead: true } } },
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
    await updateConversationLastMessage(
      message.conversationId,
      message.id,
      message.createdAt,
    );
    await claimLeadForAttendant(message.conversation.lead.id, context.user.id);

    await triggerFirstChatInteractionIfFirst({
      conversationId: input.conversationId,
      leadId: message.conversation.lead.id,
    });

    await logChatMessageSent({
      organizationId: message.conversation.tracking?.organizationId,
      conversationId: input.conversationId,
      channel,
      user: {
        id: context.user.id,
        name: context.user.name,
        email: context.user.email,
        image: (context.user as { image?: string | null }).image,
      },
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
        mediaType: message.mediaType,
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
  });
