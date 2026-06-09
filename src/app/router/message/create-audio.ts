import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import {
  CreatedMessageProps,
  MessageStatus,
} from "@/features/tracking-chat/types";
import { useConstructUrl } from "@/hooks/use-construct-url";
import prisma from "@/lib/prisma";
import { pusherServer } from "@/lib/pusher";
import { S3 } from "@/lib/s3-client";
import { PutObjectCommand } from "@aws-sdk/client-s3";
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

export const createMessageWithAudio = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    path: "/message/create-with-audio",
    summary: "Create message with audio",
  })
  .input(
    z.object({
      conversationId: z.string(),
      leadPhone: z.string(),
      token: z.string(),
      blob: z.instanceof(Blob),
      nameAudio: z.string(),
      mimetype: z.string(),
      replyId: z.string().optional(),
      id: z.string().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    try {
      // Cobra 1★ ANTES do upload S3 + chamada uazapi — evita custo sem saldo.
      const conv = await prisma.conversation.findUnique({
        where: { id: input.conversationId },
        select: {
          channel: true,
          trackingId: true,
          tracking: { select: { organizationId: true } },
        },
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
          mediaType: "audio",
        });
      }

      const buffer = Buffer.from(await input.blob.arrayBuffer());

      const presignedResponse = await S3.send(
        new PutObjectCommand({
          Bucket: process.env.NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES!,
          Key: input.nameAudio,
          Body: buffer,
          ContentType: input.mimetype,
        }),
      );

      if (!presignedResponse) {
        throw new Error("Falha ao gerar URL presignada");
      }

      // ── In-Chat Fallback ─────────────────────────────────────────────
      // Mesmo em modo In-Chat o upload S3 acontece (lead vai consumir
      // via página pública). Só pulamos a uazapi.
      const inChatMode =
        (conv?.channel ?? MessageChannel.WHATSAPP) === MessageChannel.WHATSAPP &&
        (await shouldSkipUazapiForConversation(input.conversationId));

      let externalMessageId = uuidv4();
      if (!inChatMode) {
        // Provider dispatch (Fase 6). Áudio mapeia "myaudio" Uazapi
        // (arquivo) / `audio` Meta — adapter Uazapi cuida da tradução.
        if (!conv?.trackingId) {
          throw new Error(
            "Conversation sem trackingId — não é possível resolver provider.",
          );
        }
        const resolved = await resolveOutboundProvider(conv.trackingId);
        try {
          const response = await resolved.provider.sendMedia({
            kind: "media",
            mediaKind: "audio",
            to: input.leadPhone,
            mediaUrl: useConstructUrl(input.nameAudio),
            mimetype: input.mimetype,
            replyToExternalMessageId: input.replyId,
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
          mediaUrl: input.nameAudio,
          mimetype: input.mimetype,
          messageId: externalMessageId,
          fromMe: true,
          fileName: input.nameAudio,
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
        body: "",
        mediaType: "audio",
        leadId: message.conversation.lead.id,
        leadName: message.conversation.lead.name,
      });

      return {
        message,
      };
    } catch (e) {
      console.log(e);
      throw e;
    }
  });
