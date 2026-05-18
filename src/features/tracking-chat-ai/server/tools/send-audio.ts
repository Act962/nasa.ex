import { tool } from "ai";
import { z } from "zod";
import { sendMedia } from "@/http/uazapi/send-media";
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

      const result = await sendMedia(
        ctx.instance.apiKey,
        {
          number: ctx.lead.phone,
          type: "ptt",
          file: url,
        },
        ctx.instance.baseUrl,
      );

      await persistOutboundMessage({
        conversationId: ctx.conversation.id,
        leadId: ctx.lead.id,
        trackingId: ctx.trackingId,
        body: null,
        mediaUrl: url,
        mediaType: "audio",
        senderName: ctx.settings?.assistantName ?? "IA",
        externalMessageId: result.messageid,
      });

      return { ok: true };
    },
  });
