import { tool } from "ai";
import { z } from "zod";
import { sendMedia } from "@/http/uazapi/send-media";
import { resolveOutboundProvider } from "@/features/tracking-chat/lib/providers";
import { toLegacyUazapiMessageId } from "@/features/tracking-chat/lib/providers/automated-outbound";
import { persistOutboundMessage } from "../../lib/persist";
import type { AgentContext } from "../../lib/context";

export const makeSendAudioTool = (ctx: AgentContext) =>
  tool({
    description:
      "Envia um ÁUDIO (PTT/voz) para o lead via WhatsApp. Use raramente, apenas quando o áudio agrega muito à conversa.",
    inputSchema: z.object({
      url: z.string().url().describe("URL pública do áudio (mp3/ogg/m4a)"),
    }),
    execute: async ({ url }) => {
      if (!ctx.instance) return { error: "WhatsApp instance not configured" };
      if (!ctx.lead.phone) return { error: "Lead has no phone" };

      // A porta não tem "ptt": na Uazapi segue como nota de voz; na API
      // Oficial sai como áudio comum (nota de voz exige upload em OGG/Opus).
      const resolved = await resolveOutboundProvider(ctx.trackingId);
      const externalMessageId = resolved.uazapiToken
        ? (
            await sendMedia(
              resolved.uazapiToken,
              { number: ctx.lead.phone, type: "ptt", file: url },
              resolved.uazapiBaseUrl,
            )
          ).messageid
        : toLegacyUazapiMessageId(
            await resolved.provider.sendMedia({
              kind: "media",
              mediaKind: "audio",
              to: ctx.lead.phone,
              mediaUrl: url,
            }),
          );

      await persistOutboundMessage({
        conversationId: ctx.conversation.id,
        leadId: ctx.lead.id,
        trackingId: ctx.trackingId,
        body: null,
        mediaUrl: url,
        mediaType: "audio",
        senderName: ctx.settings?.assistantName ?? "IA",
        externalMessageId,
      });

      return { ok: true };
    },
  });
