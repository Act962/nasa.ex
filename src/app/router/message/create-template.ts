import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import {
  CreatedMessageProps,
  MessageStatus,
} from "@/features/tracking-chat/types";
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
import { chargeMessageOutbound } from "@/features/stars/lib/charge-message-outbound";
import {
  OutboundProviderError,
  resolveOutboundProvider,
} from "@/features/tracking-chat/lib/providers";

/**
 * Envia um template HSM aprovado (Fase 9 — Roadmap WhatsApp Oficial).
 *
 * Exclusivo de trackings `META_CLOUD` — abre conversa fora da janela de 24h.
 * Espelha o fluxo do `create.ts` (resolve provider ANTES do charge pra não
 * cobrar ★ por mensagem que não sai), mas despacha via `provider.sendTemplate`.
 * O `previewBody` (texto já interpolado pela UI) é o que vai pra
 * `Message.body` — a Graph não devolve o corpo renderizado.
 */
export const createTemplateMessage = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    path: "/message/create-template",
    summary: "Send an approved WhatsApp template (Meta Cloud)",
  })
  .input(
    z.object({
      conversationId: z.string(),
      leadPhone: z.string(),
      templateName: z.string(),
      languageCode: z.string(),
      bodyParameters: z.array(z.string()).optional(),
      headerParameters: z.array(z.string()).optional(),
      /** Corpo já interpolado pela UI — vira `Message.body`. */
      previewBody: z.string(),
      replyId: z.string().optional(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const conversation = await prisma.conversation.findUnique({
      where: { id: input.conversationId },
      select: {
        trackingId: true,
        tracking: { select: { organizationId: true } },
      },
    });

    const organizationId = conversation?.tracking?.organizationId;
    const trackingId = conversation?.trackingId;
    if (!trackingId) {
      throw errors.BAD_REQUEST({ message: "Conversa sem tracking." });
    }

    // ── Resolve provider ANTES do charge (paridade com create.ts) ──────
    let resolved: Awaited<ReturnType<typeof resolveOutboundProvider>>;
    try {
      resolved = await resolveOutboundProvider(trackingId);
    } catch (error) {
      if (error instanceof OutboundProviderError) {
        throw errors.BAD_REQUEST({
          message: error.message,
          data: { code: error.code } as never,
        });
      }
      throw error;
    }

    if (resolved.providerId !== "meta-cloud") {
      throw errors.BAD_REQUEST({
        message:
          "Templates só podem ser enviados pela API Oficial (Meta Cloud).",
        data: { code: "PROVIDER_FEATURE_UNSUPPORTED" } as never,
      });
    }

    if (organizationId) {
      await chargeMessageOutbound({
        organizationId,
        userId: context.user.id,
        channel: "whatsapp",
        mediaType: "text",
      });
    }

    let externalMessageId: string;
    try {
      const response = await resolved.provider.sendTemplate({
        kind: "template",
        to: input.leadPhone,
        templateName: input.templateName,
        languageCode: input.languageCode,
        bodyParameters: input.bodyParameters,
        headerParameters: input.headerParameters,
        replyToExternalMessageId: input.replyId,
      });
      externalMessageId = response.externalMessageId;
    } catch (error) {
      if (error instanceof OutboundProviderError) {
        throw errors.BAD_REQUEST({
          message: error.message,
          data: { code: error.code } as never,
        });
      }
      throw error;
    }

    const message = await prisma.message.create({
      data: {
        conversationId: input.conversationId,
        body: input.previewBody,
        messageId: externalMessageId,
        fromMe: true,
        status: MessageStatus.SENT,
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
      organizationId,
      conversationId: input.conversationId,
      channel: "WHATSAPP",
      user: {
        id: context.user.id,
        name: context.user.name,
        email: context.user.email,
        image: (context.user as { image?: string }).image,
      },
      messageId: message.id,
      body: input.previewBody,
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
  });
