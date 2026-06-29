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
import { chargeMessageOutbound } from "@/features/stars/lib/charge-message-outbound";
import {
  shouldSkipUazapiForConversation,
  markInstanceConnectionFailure,
} from "@/features/tracking-chat/lib/in-chat-mode";
import { resolveOutboundProvider } from "@/features/tracking-chat/lib/providers";
import { v4 as uuidv4 } from "uuid";

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
      /**
       * @deprecated Ignorado pelo servidor desde Fase 6 — provider
       * resolvido server-side via `resolveOutboundProvider(trackingId)`.
       */
      token: z.string().nullish(),
      mediaUrl: z.string(),
      id: z.string().optional(),
      quotedMessageId: z.string().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    try {
      const conv = await prisma.conversation.findUnique({
        where: { id: input.conversationId },
        select: {
          channel: true,
          trackingId: true,
          tracking: { select: { organizationId: true } },
        },
      });

      // ── In-Chat Fallback ─────────────────────────────────────────────
      // Quando a instância está banida/offline, pula a uazapi e marca
      // `viaInChat: true` — o lead vê via `/whatsapp/[orgSlug]`.
      const inChatMode =
        (conv?.channel ?? MessageChannel.WHATSAPP) === MessageChannel.WHATSAPP &&
        (await shouldSkipUazapiForConversation(input.conversationId));

      // Resolve provider ANTES de cobrar ★ (Fix #2). Se o resolver lança
      // (instância deletada, credenciais Meta incompletas, etc.) o cliente
      // não paga ★ por mensagem que nunca sairá. In-Chat e canais não-
      // WhatsApp não passam pelo resolver.
      let resolvedWhatsapp: Awaited<ReturnType<typeof resolveOutboundProvider>> | null = null;
      if (!inChatMode && (conv?.channel ?? MessageChannel.WHATSAPP) === MessageChannel.WHATSAPP) {
        if (!conv?.trackingId) {
          throw new Error(
            "Conversation sem trackingId — não é possível resolver provider.",
          );
        }
        resolvedWhatsapp = await resolveOutboundProvider(conv.trackingId);
      }

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
          mediaType: "image",
        });
      }

      let externalMessageId = uuidv4();
      if (!inChatMode) {
        // Provider já resolvido lá em cima — reusa pra não pagar Prisma+
        // decifragem AES de novo. `input.token` ignorado (backward compat).
        const resolved = resolvedWhatsapp!;
        try {
          const response = await resolved.provider.sendMedia({
            kind: "media",
            mediaKind: "image",
            to: input.leadPhone,
            mediaUrl: useConstructUrl(input.mediaUrl),
            caption: input.body,
            replyToExternalMessageId: input.quotedMessageId,
          });
          externalMessageId = response.externalMessageId;
        } catch (err: any) {
          // Uazapi-only: detecção lazy de ban. Meta não bana.
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
          body: input.body,
          mediaUrl: input.mediaUrl,
          mimetype: "image/jpeg",
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
    } catch (e) {
      console.log(e);
      throw e;
    }
  });
