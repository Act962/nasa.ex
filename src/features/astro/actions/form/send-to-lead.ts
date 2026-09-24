import "server-only";
import { z } from "zod";
import prisma from "@/lib/prisma";
import type { AstroAction, AstroActionResult } from "../types";
import { resolveSingleLead } from "../leads/resolve-lead";

// Mandar formulário ao lead (spec 0024, onda 2 — o verbo mais valioso do
// catálogo). Cruza dois apps numa frase que hoje custa quatro telas: achar o
// formulário, copiar o link, achar a conversa, colar.
//
// ⚠️ NÃO VERIFICADO EM EXECUÇÃO — o envio depende de instância de WhatsApp
// conectada, que ainda não existe no ambiente. A montagem do link e as
// validações foram verificadas; o disparo, não.

const MAX_CANDIDATES = 5;

const inputSchema = z.object({
  formName: z.string().trim().min(2).describe("Nome do formulário. Pode ser parcial."),
  leadName: z.string().trim().min(2).describe("Lead que vai receber o link."),
  message: z
    .string()
    .trim()
    .max(500)
    .optional()
    .describe("Texto que acompanha o link, quando o usuário ditar um."),
});

function buildFormUrl(shareUrl: string, leadId: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ?? "";
  return `${base}/formulario/${shareUrl}?lead=${leadId}`;
}

export const sendFormToLeadAction: AstroAction<typeof inputSchema> = {
  key: "form.send_to_lead",
  app: "form",
  toolName: "send_form_to_lead",
  description:
    "Envia o link de um formulário para o WhatsApp de um lead — 'manda o formulário X pro Fulano'. " +
    "Use também para 'envia o briefing pro Fulano', 'dispara a ficha de cadastro pro cliente'.",
  requiresConfirmation: true,
  confirmTitle: "Enviar formulário ao cliente",
  confirmWarnings: [
    "A mensagem vai direto para o WhatsApp do cliente e não pode ser desfeita.",
  ],
  input: inputSchema,

  async execute({ ctx, input, dryRun }): Promise<AstroActionResult> {
    const forms = await prisma.form.findMany({
      where: {
        organizationId: ctx.organizationId,
        name: { contains: input.formName, mode: "insensitive" },
      },
      select: { id: true, name: true, published: true, shareUrl: true },
      take: MAX_CANDIDATES,
    });

    if (forms.length === 0) {
      return {
        status: "needs_input",
        title: "Formulário não encontrado",
        description: `Não achei formulário com "${input.formName}".`,
        missingFields: [{ key: "formName", label: "nome do formulário" }],
        appName: "Formulários",
      };
    }

    if (forms.length > 1) {
      return {
        status: "ambiguous",
        title: "Mais de um formulário",
        description: `Achei ${forms.length} formulários parecidos com "${input.formName}". Qual?`,
        field: "formName",
        options: forms.map((form) => ({ id: form.id, label: form.name })),
        appName: "Formulários",
      };
    }

    const form = forms[0];

    // Link de formulário não publicado abre em branco para o cliente. Parar
    // aqui é melhor do que mandar algo que não funciona.
    if (!form.published) {
      return {
        status: "error",
        title: "Formulário não publicado",
        description:
          `"${form.name}" está como rascunho. Publique antes de enviar — ` +
          "o link não abre para o cliente enquanto isso.",
        appName: "Formulários",
      };
    }

    if (!form.shareUrl) {
      return {
        status: "error",
        title: "Formulário sem link",
        description: `"${form.name}" não tem link público gerado.`,
        appName: "Formulários",
      };
    }

    const resolved = await resolveSingleLead({
      ctx,
      name: input.leadName,
      field: "leadName",
      appName: "Formulários",
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
        description: `"${lead.name}" não tem telefone cadastrado.`,
        appName: "Formulários",
      };
    }

    const url = buildFormUrl(form.shareUrl, lead.id);
    const text = input.message
      ? `${input.message}\n\n${url}`
      : `Olá ${lead.name}! Segue o formulário "${form.name}": ${url}`;

    if (dryRun) {
      return {
        status: "done",
        title: "Enviar formulário",
        description: `"${form.name}" será enviado para ${lead.name}.`,
        publicUrl: url,
        appName: "Formulários",
      };
    }

    const instance = details.tracking?.whatsappInstance;
    if (!instance || instance.status !== "CONNECTED") {
      return {
        status: "error",
        title: "WhatsApp não conectado",
        description:
          "O tracking desse lead não tem instância conectada. " +
          "Conecte em /integrations e tente de novo.",
        appName: "Formulários",
      };
    }

    const { resolveOutboundProviderOrBadRequest } = await import(
      "@/features/tracking-chat/lib/providers"
    );
    const provider = await resolveOutboundProviderOrBadRequest(lead.trackingId);

    try {
      await provider.provider.sendText({ kind: "text", to: details.phone, text });
    } catch (error) {
      return {
        status: "error",
        title: "Falha no envio",
        description:
          error instanceof Error ? error.message : "O provider recusou o envio.",
        appName: "Formulários",
      };
    }

    return {
      status: "done",
      title: "Formulário enviado",
      description: `"${form.name}" foi para o WhatsApp de ${lead.name}.`,
      publicUrl: url,
      internalUrl: `/form/${form.id}`,
      appName: "Formulários",
    };
  },
};
