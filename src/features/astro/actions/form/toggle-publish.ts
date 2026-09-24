import "server-only";
import { z } from "zod";
import prisma from "@/lib/prisma";
import type { AstroAction, AstroActionResult } from "../types";
import { inferPolarity } from "../infer-polarity";

// Publicar ou despublicar formulário (spec 0024, onda 2).
// Despublicar derruba o link para quem já o recebeu — por isso confirma.

const MAX_CANDIDATES = 5;

const inputSchema = z.object({
  formName: z.string().trim().min(2).describe("Nome do formulário. Pode ser parcial."),
  published: z.boolean().describe("true publica, false tira do ar."),
});

export const toggleFormPublishAction: AstroAction<typeof inputSchema> = {
  key: "form.toggle_publish",
  toolName: "toggle_form_publish",
  description:
    "Publica um formulário ou tira do ar — 'publica o formulário X', 'tira o formulário X do ar'. " +
    "Formulário publicado passa a abrir pelo link público.",
  requiresConfirmation: true,
  confirmTitle: "Mudar publicação do formulário",
  confirmWarnings: [
    "Tirar do ar derruba o link para quem já recebeu — respostas em andamento param.",
  ],
  input: inputSchema,
  inferFields: (text) =>
    inferPolarity(text, "published", /\b(despublic|tir\w*\s+do\s+ar|retir\w*\s+do\s+ar|desativ)/i, /\bpublic/i),

  async execute({ ctx, input, dryRun }): Promise<AstroActionResult> {
    const forms = await prisma.form.findMany({
      where: {
        organizationId: ctx.organizationId,
        name: { contains: input.formName, mode: "insensitive" },
      },
      select: { id: true, name: true, published: true },
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

    if (form.published === input.published) {
      return {
        status: "done",
        title: input.published ? "Já estava publicado" : "Já estava fora do ar",
        description: `"${form.name}" já está como você pediu.`,
        appName: "Formulários",
      };
    }

    if (dryRun) {
      return {
        status: "done",
        title: input.published ? "Publicar formulário" : "Tirar do ar",
        description: `"${form.name}" será ${input.published ? "publicado" : "despublicado"}.`,
        appName: "Formulários",
      };
    }

    await prisma.form.update({
      where: { id: form.id },
      data: { published: input.published },
    });

    return {
      status: "done",
      title: input.published ? "Formulário publicado" : "Formulário fora do ar",
      description: input.published
        ? `"${form.name}" está no ar e o link já abre.`
        : `"${form.name}" saiu do ar. O link parou de abrir.`,
      internalUrl: `/form/${form.id}`,
      appName: "Formulários",
    };
  },
};
