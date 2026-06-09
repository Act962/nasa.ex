import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import {
  CreatedMessageProps,
  MessageStatus,
} from "@/features/tracking-chat/types";
import { useConstructUrl } from "@/hooks/use-construct-url";
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
import {
  shouldSkipUazapiForConversation,
  markInstanceConnectionFailure,
} from "@/features/tracking-chat/lib/in-chat-mode";
import { resolveOutboundProvider } from "@/features/tracking-chat/lib/providers";
import { v4 as uuidv4 } from "uuid";

/**
 * Envia uma figurinha (sticker) pelo WhatsApp.
 *
 * Espelha `create-with-image.ts` mas usa `type: "sticker"` no uazapi. O
 * arquivo já está no R2 (vem do `UserSticker.url` cadastrado previamente).
 *
 * Diferente de imagens, sticker NÃO suporta caption (`text`) no WhatsApp.
 * Por isso `body` fica null e não exibimos input pro usuário.
 */
export const createMessageWithSticker = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    path: "/message/create-with-sticker",
    summary: "Send sticker via WhatsApp",
    tags: ["Message", "Tracking Chat"],
  })
  .input(
    z.object({
      conversationId: z.string(),
      leadPhone: z.string(),
      token: z.string(),
      /** URL do R2 onde a figurinha está salva (key ou URL completa). */
      mediaUrl: z.string(),
      /** Mimetype real do arquivo (image/webp típico). */
      mimetype: z.string().default("image/webp"),
      quotedMessageId: z.string().optional(),
      /** ID da Message citada (quando respondendo a outra mensagem). */
      id: z.string().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    // ── In-Chat Fallback ───────────────────────────────────────────────
    const inChatMode = await shouldSkipUazapiForConversation(
      input.conversationId,
    );

    let externalMessageId = uuidv4();
    if (!inChatMode) {
      // Provider dispatch (Fase 6). Sticker → mediaKind "sticker"; sem
      // caption nos dois providers (Meta também rejeita).
      const conv = await prisma.conversation.findUnique({
        where: { id: input.conversationId },
        select: { trackingId: true },
      });
      if (!conv?.trackingId) {
        throw new Error(
          "Conversation sem trackingId — não é possível resolver provider.",
        );
      }
      const resolved = await resolveOutboundProvider(conv.trackingId);
      try {
        const response = await resolved.provider.sendMedia({
          kind: "media",
          mediaKind: "sticker",
          to: input.leadPhone,
          mediaUrl: useConstructUrl(input.mediaUrl),
          mimetype: input.mimetype,
          replyToExternalMessageId: input.quotedMessageId,
        });
        externalMessageId = response.externalMessageId;
      } catch (err: any) {
        if (resolved.providerId === "uazapi" && resolved.uazapiToken) {
          const msg = String(err?.message ?? "");
          const isLikelyBan =
            msg.includes("status 401") ||
            msg.includes("status 403") ||
            msg.includes("status 500") ||
            msg.toLowerCase().includes("invalid token") ||
            msg.toLowerCase().includes("timeout");
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
        body: null,
        mediaUrl: input.mediaUrl,
        mediaType: "sticker",
        mimetype: input.mimetype,
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
          include: {
            conversation: {
              include: { lead: true },
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
      user: {
        id: context.user.id,
        name: context.user.name,
        email: context.user.email,
        image: (context.user as any).image,
      },
      messageId: message.id,
      body: "",
      // logChatMessageSent só aceita image|file|audio|text — sticker
      // categoriza como "image" pra fins de insights (mídia visual). O
      // mediaType real no DB continua "sticker".
      mediaType: "image",
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
        messageId: message.messageId,
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
  });
