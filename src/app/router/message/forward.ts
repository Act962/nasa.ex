import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import {
  dispatchForward,
  forwardPayloadSchema,
} from "@/features/tracking-chat/lib/forward-strategies";
import { chargeMessageOutbound } from "@/features/stars/lib/charge-message-outbound";
import { MessageChannel } from "@/generated/prisma/enums";
import {
  resolveOutboundProvider,
  toOutboundErrorPayload,
} from "@/features/tracking-chat/lib/providers";

/**
 * Serializa a falha de UM destino preservando o `code` do domínio
 * outbound (spec 0010, RF-6/CB-8).
 *
 * O forward não aborta a requisição inteira quando um destino falha —
 * cada item carrega o próprio resultado. Por isso aqui NÃO usamos
 * `mapOutboundError` (que produz `ORPCError` pra derrubar o handler):
 * extraímos o payload e o embutimos na resposta. Antes era
 * `String(reason)`, que achatava "credencial Meta incompleta" e "timeout
 * de rede" na mesma string opaca.
 */
function toForwardFailure(conversationId: string, reason: unknown) {
  const payload = toOutboundErrorPayload(reason);
  return {
    conversationId,
    success: false,
    error: payload?.message ?? String(reason),
    code: payload?.data.code,
  };
}
import prisma from "@/lib/prisma";
import z from "zod";

type ForwardKind = z.infer<typeof forwardPayloadSchema>["kind"];

function payloadKindToMediaType(
  kind: ForwardKind,
): "text" | "image" | "audio" | "file" | "location" | "contact" {
  switch (kind) {
    case "text":
      return "text";
    case "contact":
      return "contact";
    case "location":
      return "location";
    case "media":
      return "file";
    default:
      return "text";
  }
}

export const forwardMessageHandler = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    path: "/message/forward",
    summary: "Forward message to conversations",
  })
  .input(
    z.object({
      conversationIds: z.array(z.string()).min(1),
      /**
       * @deprecated Ignorado pelo servidor desde Fase 6 — provider
       * resolvido server-side via `resolveOutboundProvider(trackingId)`.
       */
      token: z.string().nullish(),
      payload: forwardPayloadSchema,
    }),
  )
  .handler(async ({ input, context }) => {
    const results = await Promise.allSettled(
      input.conversationIds.map(async (conversationId) => {
        const conversation = await prisma.conversation.findUnique({
          where: { id: conversationId },
          select: {
            remoteJid: true,
            channel: true,
            trackingId: true,
            lead: { select: { phone: true } },
            tracking: { select: { organizationId: true } },
          },
        });

        if (!conversation) {
          throw new Error(`Conversation ${conversationId} not found`);
        }

        const channel = conversation.channel ?? MessageChannel.WHATSAPP;
        if (channel !== MessageChannel.WHATSAPP) {
          throw new Error(`Channel ${channel} not supported for forwarding`);
        }

        const number =
          conversation.lead.phone ??
          conversation.remoteJid.replace("@s.whatsapp.net", "");

        // Resolve provider ANTES de cobrar ★ (Fix #2). `input.token`
        // mantido no schema por backward compat mas ignorado — source of
        // truth é o banco.
        const resolved = await resolveOutboundProvider(conversation.trackingId);

        await chargeMessageOutbound({
          organizationId: conversation.tracking.organizationId,
          userId: context.user.id,
          channel: "whatsapp",
          mediaType: payloadKindToMediaType(input.payload.kind),
        });

        const ctx = {
          conversationId,
          number,
          provider: resolved.provider,
          senderName: context.user.name,
        };

        const message = await dispatchForward(input.payload, ctx);

        return {
          conversationId,
          messageId: message.messageId,
          body: message.body,
          mediaUrl: message.mediaUrl,
          mediaType: message.mediaType,
          mimetype: message.mimetype,
          fileName: message.fileName,
          createdAt: message.createdAt,
          success: true,
        };
      }),
    );

    return {
      results: results.map((result, i) =>
        result.status === "fulfilled"
          ? result.value
          : toForwardFailure(
              input.conversationIds[i],
              (result as PromiseRejectedResult).reason,
            ),
      ),
    };
  });
