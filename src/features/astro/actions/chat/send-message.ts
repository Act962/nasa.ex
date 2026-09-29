import "server-only";
import { z } from "zod";
import prisma from "@/lib/prisma";
import type { AstroAction, AstroActionResult } from "../types";
import { resolveSingleLead } from "../leads/resolve-lead";
import { LEAD_FIELD_STEP, extractNameAfter } from "../leads/lead-steps";

// Mensagem de texto ao lead pelo WhatsApp do funil dele. Nasceu dos pedidos
// compostos (spec 0033, RF-6): "marca a reunião e avisa ela no WhatsApp" tinha
// a segunda metade ignorada, porque não havia verbo para mandar texto livre.

/** "manda uma mensagem pra Maria Clara dizendo que atrasei" → lead e texto. */
function inferMessageFields(text: string): Record<string, unknown> {
  const inferred: Record<string, unknown> = {};
  const leadName = extractNameAfter(text, ["pro", "pra", "para", "ao", "a"]);
  if (leadName) inferred.leadName = leadName;
  const message = text.match(/\b(?:dizendo|falando|avisando)\s+(?:que\s+)?(.{2,500})$/iu)?.[1];
  if (message) inferred.message = message.trim();
  return inferred;
}

const inputSchema = z.object({
  leadName: z.string().trim().min(2).describe("Nome do lead que recebe a mensagem."),
  message: z.string().trim().min(2).max(1000).describe("Texto da mensagem, como o usuário ditou."),
});

export const sendMessageAction: AstroAction<typeof inputSchema> = {
  key: "chat.send_message",
  app: "chat",
  toolName: "send_whatsapp_message",
  description:
    "Envia uma mensagem de texto para um lead pelo WhatsApp. " +
    "Use quando o usuário disser 'avisa o Fulano no WhatsApp', 'manda uma mensagem pro Fulano dizendo X'.",
  permission: { appKey: "chat", action: "create" },
  requiresConfirmation: true,
  confirmTitle: "Enviar mensagem ao cliente",
  confirmWarnings: ["A mensagem vai direto para o WhatsApp do cliente e não pode ser desfeita."],
  input: inputSchema,
  inferFields: inferMessageFields,
  intentPatterns: [
    /^(?!.*\b(template|modelo|formulario)\b)(?!.*\bme\s+(manda|mande|envia|envie|avisa|avise)\b)(?!.*\bmeu\s+whats).*\b(avisa|avise|avisar)\b.{0,30}\b(whats|whatsapp|zap)\b/,
    /^(?!.*\b(template|modelo|formulario)\b)(?!.*\bme\s+(manda|mande|envia|envie)\b).*\b(manda|mande|mandar|envia|envie|enviar)\s+(uma\s+)?(mensagem|msg)\b/,
  ],
  fieldSteps: {
    leadName: { ...LEAD_FIELD_STEP, title: "Para qual lead?" },
    message: {
      title: "Qual mensagem?",
      question: "Escreva o texto que vai para o cliente.",
      picker: { kind: "text", placeholder: "Ex.: Olá! Nossa reunião foi confirmada.", maxLength: 1000 },
    },
  },

  async execute({ ctx, input, dryRun }): Promise<AstroActionResult> {
    const resolved = await resolveSingleLead({
      ctx,
      name: input.leadName,
      field: "leadName",
      appName: "Chat",
    });
    if ("failure" in resolved) return resolved.failure;
    const lead = resolved.lead;

    const details = await prisma.lead.findUnique({
      where: { id: lead.id },
      select: {
        phone: true,
        tracking: { select: { whatsappInstance: { select: { status: true } } } },
      },
    });

    if (!details?.phone) {
      return {
        status: "error",
        title: "Lead sem telefone",
        description: `"${lead.name}" não tem telefone cadastrado — nada foi enviado.`,
        appName: "Chat",
      };
    }

    // Antes do cartão: sem WhatsApp conectado, confirmar seria decidir em vão.
    const instance = details.tracking?.whatsappInstance;
    if (!instance || instance.status !== "CONNECTED") {
      return {
        status: "error",
        title: "WhatsApp não conectado",
        description:
          "O funil desse lead não tem WhatsApp conectado — nada foi enviado. " +
          "Conecte em /integrations e tente de novo.",
        appName: "Chat",
      };
    }

    if (dryRun) {
      return {
        status: "done",
        title: "Enviar mensagem",
        description: `Para ${lead.name}: "${input.message.slice(0, 160)}"`,
        appName: "Chat",
      };
    }

    const { resolveOutboundProviderOrBadRequest } = await import(
      "@/features/tracking-chat/lib/providers"
    );
    const resolvedProvider = await resolveOutboundProviderOrBadRequest(lead.trackingId);

    try {
      await resolvedProvider.provider.sendText({ kind: "text", to: details.phone, body: input.message });
    } catch (error) {
      return {
        status: "error",
        title: "Falha no envio",
        description: error instanceof Error ? error.message : "O provider recusou o envio.",
        appName: "Chat",
      };
    }

    return {
      status: "done",
      title: "Mensagem enviada",
      description: `Mensagem enviada para ${lead.name}.`,
      appName: "Chat",
    };
  },
};
