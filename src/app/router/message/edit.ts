import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import z from "zod";
import { editMessage } from "@/http/uazapi/edit-message";
import { logActivity } from "@/features/admin/lib/activity-logger";
import prisma from "@/lib/prisma";
import { MessageStatus } from "@/generated/prisma/enums";
import {
  MetaFeatureUnsupportedError,
  resolveOutboundProviderOrBadRequest,
} from "@/features/tracking-chat/lib/providers";

export const editMessageHandler = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    path: "/message/edit",
    summary: "Edit message",
  })
  .input(
    z.object({
      id: z.string(),
      text: z.string(),
      /**
       * @deprecated Ignorado — o token Uazapi é resolvido server-side via
       * `resolveOutboundProviderOrBadRequest(trackingId)`.
       */
      token: z.string().nullish(),
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
              tracking: { select: { organizationId: true, name: true } },
              lead: { select: { name: true } },
            },
          },
        },
      });

      const trackingId = messageBefore?.conversation?.trackingId;
      if (!trackingId) {
        throw errors.BAD_REQUEST({
          message: "Mensagem sem trackingId — não é possível editar.",
        });
      }

      // Resolve credenciais server-side — o client não trafega mais o token
      // Uazapi. `input.token` é ignorado.
      const resolved = await resolveOutboundProviderOrBadRequest(trackingId);

      // ── Gate Meta unsupported (Fase 6) ─────────────────────────────────
      // Meta Cloud API não tem endpoint pra editar mensagem outbound. Se o
      // tracking estiver em META_CLOUD recusamos antes de chamar Uazapi.
      if (resolved.providerId !== "uazapi" || !resolved.uazapiToken) {
        const err = new MetaFeatureUnsupportedError("edit");
        throw errors.BAD_REQUEST({
          message: err.message,
          data: { code: err.code, feature: err.feature } as never,
        });
      }

      const response = await editMessage({
        data: {
          id: input.id,
          text: input.text,
        },
        token: resolved.uazapiToken,
      });

      if (!response) {
        throw new Error("Failed to edit message or message not found");
      }

      await prisma.message.update({
        where: {
          messageId: input.id,
        },
        data: {
          body: response.content.text,
          messageId: response.messageid,
          status: MessageStatus.SEEN,
        },
      });

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
          featureKey: "chat.message.edited",
          action: "chat.message.edited",
          actionLabel: `Editou mensagem do lead "${conv.lead?.name ?? "—"}"`,
          resource: conv.lead?.name ?? undefined,
          resourceId: messageBefore.id,
          metadata: {
            conversationId: conv.id,
            leadId: conv.leadId,
            trackingId: conv.trackingId,
            previousBody: messageBefore.body ?? null,
            newBody: response.content.text,
          },
        });
      }

      return response;
    } catch (e) {
      console.error("Error editing message:", e);
      throw e;
    }
  });
