import { tool } from "ai";
import { z } from "zod";
import { resolveOutboundProvider } from "@/features/tracking-chat/lib/providers";
import { toLegacyUazapiMessageId } from "@/features/tracking-chat/lib/providers/automated-outbound";
import { persistOutboundMessage } from "../../lib/persist";
import type { AgentContext } from "../../lib/context";

export const makeSendImageTool = (ctx: AgentContext) =>
  tool({
    description:
      "Envia uma IMAGEM para o lead via WhatsApp. Use quando precisar mostrar foto de produto, captura de tela ou material visual. Não use para responder em texto.",
    inputSchema: z.object({
      url: z.string().url().describe("URL pública da imagem (jpg/png/webp)"),
      caption: z
        .string()
        .max(300)
        .optional()
        .describe("Legenda curta opcional"),
    }),
    execute: async ({ url, caption }) => {
      if (!ctx.instance) return { error: "WhatsApp instance not configured" };
      if (!ctx.lead.phone) return { error: "Lead has no phone" };

      const resolved = await resolveOutboundProvider(ctx.trackingId);
      const sent = await resolved.provider.sendMedia({
        kind: "media",
        mediaKind: "image",
        to: ctx.lead.phone,
        mediaUrl: url,
        caption,
      });

      await persistOutboundMessage({
        conversationId: ctx.conversation.id,
        leadId: ctx.lead.id,
        trackingId: ctx.trackingId,
        body: caption ?? null,
        mediaUrl: url,
        mediaType: "image",
        mediaCaption: caption ?? null,
        senderName: ctx.settings?.assistantName ?? "IA",
        externalMessageId: toLegacyUazapiMessageId(sent),
      });

      return { ok: true };
    },
  });
