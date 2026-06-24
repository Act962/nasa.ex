import { tool } from "ai";
import { z } from "zod";
import { sendButtons } from "@/http/uazapi/send-menu";
import { requireUazapiToken } from "@/features/tracking-chat/lib/providers/uazapi-credentials";
import { persistOutboundMessage } from "../../lib/persist";
import type { AgentContext } from "../../lib/context";

const buttonShape = z.object({
  text: z.string(),
  id: z.string(),
  tagId: z.string().optional(),
});

function parsePresetButtons(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((b) => {
    const r = buttonShape.safeParse(b);
    return r.success ? [r.data] : [];
  });
}

export const makeSendButtonsTool = (ctx: AgentContext) =>
  tool({
    description:
      "Envia uma mensagem interativa com BOTÕES pré-cadastrada (preset). " +
      "Use quando a resposta couber em opções rápidas e existir um preset " +
      "no catálogo cuja descrição case com a situação. O lead vê os botões " +
      "no WhatsApp e pode clicar.",
    inputSchema: z.object({
      presetId: z
        .string()
        .describe("O id exato de um preset listado no catálogo de botões."),
    }),
    execute: async ({ presetId }) => {
      if (!ctx.instance) return { error: "no_whatsapp_instance" };
      if (!ctx.lead.phone) return { error: "lead_without_phone" };

      const preset = ctx.availableButtonPresets.find((p) => p.id === presetId);
      if (!preset) return { error: "preset_not_found", presetId };

      const buttons = parsePresetButtons(preset.buttons);
      if (buttons.length === 0) {
        return { error: "preset_has_no_buttons", presetId };
      }

      try {
        const result = await sendButtons(
          requireUazapiToken(ctx.instance.apiKey),
          {
            number: ctx.lead.phone,
            text: preset.bodyText,
            footer: preset.footerText ?? undefined,
            // Não trunca — se >3, Uazapi recusa e o catch devolve erro
            // pro modelo. Decisão consciente: a UI permite N botões.
            buttons,
            readchat: true,
            readmessages: true,
          },
          ctx.instance.baseUrl ?? undefined,
        );

        const summary = buttons.map((b) => `• ${b.text}`).join("\n");
        const body = `${preset.bodyText}\n\n[Botões]\n${summary}`;

        // buttonTagMap (buttonId→tagId) — grava no metadata pra o webhook
        // aplicar a tag quando o lead clicar num botão com tag associada.
        const buttonTagMap: Record<string, string> = {};
        for (const button of buttons) {
          if (button.id && button.tagId) {
            buttonTagMap[button.id] = button.tagId;
          }
        }

        await persistOutboundMessage({
          conversationId: ctx.conversation.id,
          leadId: ctx.lead.id,
          trackingId: ctx.trackingId,
          body,
          senderName: ctx.settings?.assistantName ?? "IA",
          externalMessageId: result.messageid,
          metadata:
            Object.keys(buttonTagMap).length > 0 ? { buttonTagMap } : null,
        });

        return { ok: true, presetName: preset.name };
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Falha ao enviar botões";
        return { error: "uazapi_send_failed", message };
      }
    },
  });
