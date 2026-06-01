import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import {
  CreatedMessageProps,
  MessageStatus,
} from "@/features/tracking-chat/types";
import { sendText } from "@/http/uazapi/send-text";
import { sendInstagramDm } from "@/http/meta/send-instagram-dm";
import { sendFacebookMessage } from "@/http/meta/send-facebook-message";
import prisma from "@/lib/prisma";
import { pusherServer } from "@/lib/pusher";
import { IntegrationPlatform, MessageChannel } from "@/generated/prisma/enums";
import z from "zod";
import { v4 as uuidv4 } from "uuid";
import {
  attendLeadIfWaiting,
  updateConversationLastMessage,
  claimLeadForAttendant,
  logChatMessageSent,
  triggerFirstChatInteractionIfFirst,
} from "./utils";
import {
  shouldSkipUazapiForConversation,
  markInstanceConnectionFailure,
} from "@/features/tracking-chat/lib/in-chat-mode";
import { chargeMessageOutbound } from "@/features/stars/lib/charge-message-outbound";

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
  .handler(async ({ input, context, errors }) => {
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

      // ── In-Chat Fallback ─────────────────────────────────────────────
      // Quando a instância está banida/offline (detectado pelo cron
      // `detect-whatsapp-ban`), a mensagem NÃO vai pra uazapi. Em vez
      // disso é salva com `viaInChat: true` e fica visível pro lead via
      // página pública `/whatsapp/[orgSlug]`. Aplica só pra channel
      // WHATSAPP (IG/FB não passam pela uazapi).
      const inChatMode =
        channel === MessageChannel.WHATSAPP &&
        (await shouldSkipUazapiForConversation(input.conversationId));
      // Cobra 1★ antes de chamar uazapi/Meta — evita custo de API sem saldo.
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
          mediaType: "text",
        });
      }

      let externalMessageId = uuidv4();

      if (channel === MessageChannel.INSTAGRAM) {
        const integration = await prisma.platformIntegration.findFirst({
          where: {
            platform: IntegrationPlatform.INSTAGRAM,
            organizationId,
            isActive: true,
          },
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
          where: {
            platform: IntegrationPlatform.META,
            organizationId,
            isActive: true,
          },
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
      } else if (inChatMode) {
        // Pula a uazapi — em modo In-Chat o lead vê via página pública.
        // `externalMessageId` fica como `uuidv4()` (gerado acima), o que
        // é OK porque In-Chat não precisa de tracking external.
      } else {
        try {
          const response = await sendText(input.token, {
            text: input.body,
            number: input.leadPhone,
            replyid: input.replyId,
            readmessages: true,
            readchat: true,
          });
          externalMessageId = response.messageid;
        } catch (err: any) {
          // Lazy detection do ban: se a uazapi rejeitou por auth/erro
          // de servidor, incrementa o contador. Quando passar do
          // threshold (3 falhas), ativa modo In-Chat — próximas
          // mensagens pulam o uazapi automaticamente.
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
          // Erro específico de sessão WhatsApp caída — devolve um BAD_REQUEST
          // com código semântico pro frontend mostrar UI de reconexão em vez
          // do toast genérico "Erro ao enviar mensagem".
          const isWhatsappDown =
            msg.includes("session is not reconnectable") ||
            msg.includes("status 503") ||
            msg.toLowerCase().includes("whatsapp disconnected");
          if (isWhatsappDown) {
            throw errors.BAD_REQUEST({
              message: "WHATSAPP_DISCONNECTED",
              data: {
                code: "WHATSAPP_DISCONNECTED",
                detail:
                  "A sessão do WhatsApp caiu. Reconecte a instância em Configurações → Instâncias → Gerar novo QR.",
                originalMessage: msg,
              } as never,
            });
          }
          throw err;
        }
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
          // Marca a origem da mensagem — In-Chat (página pública) ou
          // WhatsApp normal. Visível em Insights e ajuda no debug.
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
