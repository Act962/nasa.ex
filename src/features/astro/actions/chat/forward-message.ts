import "server-only";
import { z } from "zod";
import prisma from "@/lib/prisma";
import type { AstroAction, AstroActionResult } from "../types";
import { resolveSingleLead } from "../leads/resolve-lead";

// Encaminhar mensagem (spec 0024, onda 1).
//
// ⚠️ NÃO VERIFICADO EM EXECUÇÃO — depende de instância de WhatsApp conectada.
//
// A spec dizia "encaminha essa mensagem", mas "essa" o Astro não sabe qual é:
// ele não enxerga o que está na tela. O verbo então é sempre sobre a ÚLTIMA
// mensagem de uma conversa nomeada — é o que alguém de fato diz e o que dá
// para conferir no cartão antes de confirmar.

const inputSchema = z.object({
  fromLeadName: z
    .string()
    .trim()
    .min(2)
    .describe("Lead de cuja conversa sai a última mensagem."),
  toLeadName: z.string().trim().min(2).describe("Lead que vai receber."),
});

export const forwardMessageAction: AstroAction<typeof inputSchema> = {
  key: "chat.forward_message",
  app: "chat",
  toolName: "forward_last_message",
  description:
    "Encaminha a última mensagem da conversa de um lead para outro lead. " +
    "Use quando o usuário disser 'encaminha a última mensagem do Fulano pro Beltrano', " +
    "'manda o que o Fulano falou pro Beltrano'.",
  requiresConfirmation: true,
  confirmTitle: "Encaminhar mensagem",
  confirmWarnings: [
    "A mensagem vai direto para o WhatsApp do destinatário e não pode ser desfeita.",
  ],
  input: inputSchema,

  async execute({ ctx, input, dryRun }): Promise<AstroActionResult> {
    const origin = await resolveSingleLead({
      ctx,
      name: input.fromLeadName,
      field: "fromLeadName",
      appName: "Chat",
    });
    if ("failure" in origin) return origin.failure;

    const target = await resolveSingleLead({
      ctx,
      name: input.toLeadName,
      field: "toLeadName",
      appName: "Chat",
    });
    if ("failure" in target) return target.failure;

    const lastMessage = await prisma.message.findFirst({
      where: { conversation: { leadId: origin.lead.id } },
      orderBy: { createdAt: "desc" },
      select: { id: true, body: true, mediaType: true },
    });

    if (!lastMessage) {
      return {
        status: "error",
        title: "Conversa vazia",
        description: `Não há mensagem na conversa de ${origin.lead.name}.`,
        appName: "Chat",
      };
    }

    if (lastMessage.mediaType && lastMessage.mediaType !== "text") {
      return {
        status: "error",
        title: "Mensagem com mídia",
        description:
          "A última mensagem tem anexo. Encaminhe pela tela do chat — " +
          "o Astro só encaminha texto.",
        appName: "Chat",
      };
    }

    const preview = (lastMessage.body ?? "").slice(0, 120);

    if (dryRun) {
      return {
        status: "done",
        title: "Encaminhar mensagem",
        description:
          `De ${origin.lead.name} para ${target.lead.name}: "${preview}"`,
        appName: "Chat",
      };
    }

    const details = await prisma.lead.findUnique({
      where: { id: target.lead.id },
      select: {
        phone: true,
        tracking: { select: { whatsappInstance: { select: { status: true } } } },
      },
    });

    if (!details?.phone) {
      return {
        status: "error",
        title: "Destinatário sem telefone",
        description: `"${target.lead.name}" não tem telefone cadastrado.`,
        appName: "Chat",
      };
    }

    const instance = details.tracking?.whatsappInstance;
    if (!instance || instance.status !== "CONNECTED") {
      return {
        status: "error",
        title: "WhatsApp não conectado",
        description:
          "O tracking do destinatário não tem instância conectada. " +
          "Conecte em /integrations e tente de novo.",
        appName: "Chat",
      };
    }

    const { resolveOutboundProviderOrBadRequest } = await import(
      "@/features/tracking-chat/lib/providers"
    );
    const resolvedProvider = await resolveOutboundProviderOrBadRequest(
      target.lead.trackingId,
    );

    try {
      await resolvedProvider.provider.sendText({
        kind: "text",
        to: details.phone,
        text: lastMessage.body ?? "",
      });
    } catch (error) {
      return {
        status: "error",
        title: "Falha no encaminhamento",
        description:
          error instanceof Error
            ? error.message
            : "O provider recusou o envio.",
        appName: "Chat",
      };
    }

    return {
      status: "done",
      title: "Mensagem encaminhada",
      description: `Mensagem de ${origin.lead.name} encaminhada para ${target.lead.name}.`,
      appName: "Chat",
    };
  },
};
