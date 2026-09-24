import "server-only";
import { z } from "zod";
import prisma from "@/lib/prisma";
import type { AstroAction, AstroActionResult } from "../types";
import { resolveOutboundProviderOrBadRequest } from "@/features/tracking-chat/lib/providers";
import { resolveSingleLead } from "../leads/resolve-lead";

/** Templates do projeto são pt_BR; idioma por frase seria campo a mais sem ganho. */
const DEFAULT_LANGUAGE_CODE = "pt_BR";

// Enviar template aprovado do WhatsApp (spec 0024, onda 1).
//
// ⚠️ NÃO VERIFICADO EM EXECUÇÃO — escrito antes de haver instância conectada
// e templates aprovados no ambiente. O envio em si reusa a mesma rota de
// `message/create-template.ts`, que valida a janela de 24h e o provider.
//
// Confirmação obrigatória mesmo não sendo destrutivo: template cai direto no
// WhatsApp do cliente, e mensagem enviada não volta.

const inputSchema = z.object({
  leadName: z.string().trim().min(2).describe("Nome do lead destinatário."),
  templateName: z
    .string()
    .trim()
    .min(2)
    .describe("Nome do template aprovado, como cadastrado na Meta."),
  parameters: z
    .array(z.string())
    .optional()
    .describe("Valores das variáveis do template, na ordem em que aparecem."),
});

export const sendTemplateAction: AstroAction<typeof inputSchema> = {
  key: "chat.send_template",
  app: "chat",
  toolName: "send_whatsapp_template",
  description:
    "Envia um template aprovado do WhatsApp para um lead. " +
    "Use quando o usuário disser 'manda o template de boas-vindas pro Fulano', " +
    "'dispara o modelo X pro Fulano'.",
  requiresConfirmation: true,
  confirmTitle: "Enviar template ao cliente",
  confirmWarnings: [
    "A mensagem vai direto para o WhatsApp do cliente e não pode ser desfeita.",
  ],
  input: inputSchema,

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
        conversation: { select: { id: true } },
        tracking: {
          select: {
            whatsappInstance: { select: { status: true } },
          },
        },
      },
    });

    if (!details?.phone) {
      return {
        status: "error",
        title: "Lead sem telefone",
        description: `"${lead.name}" não tem telefone cadastrado.`,
        appName: "Chat",
      };
    }

    const instance = details.tracking?.whatsappInstance;
    if (!instance || instance.status !== "CONNECTED") {
      return {
        status: "error",
        title: "WhatsApp não conectado",
        description:
          "O tracking desse lead não tem instância de WhatsApp conectada. " +
          "Conecte em /integrations e tente de novo.",
        appName: "Chat",
      };
    }

    if (dryRun) {
      return {
        status: "done",
        title: "Enviar template",
        description: `O template "${input.templateName}" será enviado para ${lead.name}.`,
        appName: "Chat",
      };
    }

    // O envio de template exige conversa: é nela que a mensagem é registrada.
    const conversation =
      details.conversation ??
      (await prisma.conversation.create({
        data: { leadId: lead.id },
        select: { id: true },
      }));

    // Despacha pelo mesmo provider da tela: é ele que sabe a diferença entre
    // META_CLOUD e uazapi e que trata a janela de 24h.
    const resolvedProvider = await resolveOutboundProviderOrBadRequest(
      lead.trackingId,
    );

    try {
      await resolvedProvider.provider.sendTemplate({
        kind: "template",
        to: details.phone,
        templateName: input.templateName,
        languageCode: DEFAULT_LANGUAGE_CODE,
        bodyParameters: input.parameters ?? [],
      });
    } catch (error) {
      return {
        status: "error",
        title: "Falha no envio",
        description:
          error instanceof Error
            ? error.message
            : "O provider recusou o envio do template.",
        appName: "Chat",
      };
    }

    return {
      status: "done",
      title: "Template enviado",
      description: `"${input.templateName}" foi enviado para ${lead.name}.`,
      internalUrl: `/tracking-chat/${conversation.id}`,
      appName: "Chat",
    };
  },
};
