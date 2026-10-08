import { tool } from "ai";
import { z } from "zod";
import { resolveOutboundProvider } from "@/features/tracking-chat/lib/providers";
import { toLegacyUazapiMessageId } from "@/features/tracking-chat/lib/providers/automated-outbound";
import { persistOutboundMessage } from "../../lib/persist";
import type { AgentContext } from "../../lib/context";

export const makeSendDocumentTool = (ctx: AgentContext) =>
  tool({
    description:
      "Envia um DOCUMENTO (PDF, planilha, contrato, etc) para o lead via WhatsApp. Use para materiais, propostas, contratos.",
    inputSchema: z.object({
      url: z.string().url().describe("URL pública do documento"),
      fileName: z
        .string()
        .min(1)
        .describe("Nome do arquivo com extensão (ex: 'proposta.pdf')"),
      caption: z
        .string()
        .max(300)
        .optional()
        .describe("Texto curto que acompanha o documento"),
    }),
    execute: async ({ url, fileName, caption }) => {
      if (!ctx.instance) return { error: "WhatsApp instance not configured" };
      if (!ctx.lead.phone) return { error: "Lead has no phone" };

      const resolved = await resolveOutboundProvider(ctx.trackingId);
      const sent = await resolved.provider.sendMedia({
        kind: "media",
        mediaKind: "document",
        to: ctx.lead.phone,
        mediaUrl: url,
        fileName,
        caption,
      });

      await persistOutboundMessage({
        conversationId: ctx.conversation.id,
        leadId: ctx.lead.id,
        trackingId: ctx.trackingId,
        body: caption ?? null,
        mediaUrl: url,
        mediaType: "document",
        mediaCaption: caption ?? null,
        fileName,
        senderName: ctx.settings?.assistantName ?? "IA",
        externalMessageId: toLegacyUazapiMessageId(sent),
      });

      return { ok: true };
    },
  });
