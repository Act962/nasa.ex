import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import z from "zod";
import { deleteMessage } from "@/http/uazapi/delete-message";
import { logActivity } from "@/features/admin/lib/activity-logger";
import prisma from "@/lib/prisma";
import { MessageStatus, WhatsAppProvider } from "@/generated/prisma/enums";
import { pusherServer } from "@/lib/pusher";
import { MetaFeatureUnsupportedError } from "@/features/tracking-chat/lib/providers";

export const deleteMessageHandler = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    path: "/message/delete",
    summary: "Delete message",
  })
  .input(
    z.object({
      id: z.string(),
      token: z.string(),
      messageId: z.string(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    try {
      const messageBefore = await prisma.message.findUnique({
        where: { messageId: input.id },
        select: {
          id: true,
          body: true,
          conversationId: true,
          conversation: {
            select: {
              id: true,
              leadId: true,
              trackingId: true,
              tracking: { select: { organizationId: true } },
              lead: { select: { name: true } },
            },
          },
        },
      });

      // ── Gate Meta unsupported (Fase 6) ─────────────────────────────────
      // Meta Cloud API não tem endpoint pra apagar mensagem outbound (só
      // recebe revoke via webhook). Recusamos antes de chamar Uazapi.
      if (messageBefore?.conversation?.trackingId) {
        const instance = await prisma.whatsAppInstance.findUnique({
          where: { trackingId: messageBefore.conversation.trackingId },
          select: { provider: true },
        });
        if (instance?.provider === WhatsAppProvider.META_CLOUD) {
          const err = new MetaFeatureUnsupportedError("delete");
          throw errors.BAD_REQUEST({
            message: err.message,
            data: { code: err.code, feature: err.feature } as never,
          });
        }
      }

      const response = await deleteMessage({
        id: input.id,
        token: input.token,
      });

      if (!response) {
        throw new Error("Message not found");
      }

      // Soft delete — mantém o registro mas marca como DELETED + limpa
      // body/mídia. UI exibe "🚫 Mensagem apagada" em itálico (estilo
      // WhatsApp). Evita perder o slot na timeline + permite auditoria.
      const updated = await prisma.message.update({
        where: { messageId: input.id },
        data: {
          status: MessageStatus.DELETED,
          body: null,
          mediaUrl: null,
          mediaType: null,
          mediaCaption: null,
          mimetype: null,
          fileName: null,
        },
        select: { id: true, conversationId: true },
      });

      // Dispara evento real-time pros atendentes que estão com a conversa
      // aberta verem o "Mensagem apagada" sem precisar refresh.
      pusherServer
        .trigger(updated.conversationId, "message:updated", {
          messageId: updated.id,
          conversationId: updated.conversationId,
          status: MessageStatus.DELETED,
        })
        .catch(() => {});

      if (messageBefore?.conversation?.tracking?.organizationId) {
        const conv = messageBefore.conversation;
        await logActivity({
          organizationId: conv.tracking.organizationId,
          userId: context.user.id,
          userName: context.user.name,
          userEmail: context.user.email,
          userImage: (context.user as any).image,
          appSlug: "chat",
          subAppSlug: "tracking-chat",
          featureKey: "chat.message.deleted",
          action: "chat.message.deleted",
          actionLabel: `Excluiu mensagem do lead "${conv.lead?.name ?? "—"}"`,
          resource: conv.lead?.name ?? undefined,
          resourceId: messageBefore.id,
          metadata: {
            conversationId: conv.id,
            leadId: conv.leadId,
            trackingId: conv.trackingId,
            deletedBody: messageBefore.body ?? null,
          },
        });
      }
    } catch (e) {
      console.log(e);
      throw e;
    }
  });
