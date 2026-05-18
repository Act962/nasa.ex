import { tool } from "ai";
import { z } from "zod";
import { sendMedia } from "@/http/uazapi/send-media";
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

      const result = await sendMedia(
        ctx.instance.apiKey,
        {
          number: ctx.lead.phone,
          type: "document",
          file: url,
          docName: fileName,
          text: caption,
        },
        ctx.instance.baseUrl,
      );

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
        externalMessageId: result.messageid,
      });

      return { ok: true };
    },
  });
