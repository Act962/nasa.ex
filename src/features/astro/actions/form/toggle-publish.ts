import "server-only";
import { z } from "zod";
import prisma from "@/lib/prisma";
import type { AstroAction, AstroActionResult } from "../types";
import { parsePickedAnswer, type AstroPicker } from "@/features/astro/lib/astro-picker";
import { inferPolarity } from "../infer-polarity";

const FORM_PICKER: AstroPicker = { kind: "entity", entity: "form", placeholder: "Buscar formulário" };

// Publicar ou despublicar formulário (spec 0024, onda 2).
// Despublicar derruba o link para quem já o recebeu — por isso confirma.

const MAX_CANDIDATES = 5;

const inputSchema = z.object({
  formName: z.string().trim().min(2).describe("Nome do formulário. Pode ser parcial."),
  published: z.boolean().describe("true publica, false tira do ar."),
});

export const toggleFormPublishAction: AstroAction<typeof inputSchema> = {
  key: "form.toggle_publish",
  app: "form",
  toolName: "toggle_form_publish",
  description:
    "Publica um formulário ou tira do ar — 'publica o formulário X', 'tira o formulário X do ar'. " +
    "Formulário publicado passa a abrir pelo link público.",
  permission: { appKey: "formularios", action: "edit" },
  requiresConfirmation: true,
  confirmTitle: "Mudar publicação do formulário",
  confirmWarnings: [
    "Tirar do ar derruba o link para quem já recebeu — respostas em andamento param.",
  ],
  input: inputSchema,
  inferFields: (text) => {
    const formName = text.match(/\bformul[aá]rio\s+(.+?)(?=\s+(?:do ar|no ar)\b|[.!?]*$)/iu)?.[1];
    return {
      // "tirar um formulário do ar": o objeto pode vir entre o verbo e "do ar".
      ...inferPolarity(text, "published", /\b(despublic|(?:tir|retir)\w*\b.{0,40}\bdo\s+ar|desativ)/i, /\bpublic/i),
      ...(formName ? { formName: formName.trim() } : {}),
    };
  },
  intentPatterns: [
    /\b(publica|publicar|publique|despublica|despublicar|despublique)\b.{0,20}\bformulario\b/,
    /\b(tira|tirar|tire|retira|retirar)\b.{0,30}\bformulario\b.{0,30}\bdo ar\b/,
  ],
  fieldSteps: {
    formName: { title: "Qual formulário?", question: "Busque o formulário.", picker: FORM_PICKER },
    published: {
      title: "Publicar ou tirar do ar?",
      question: "O que fazer com o formulário?",
      picker: {
        kind: "select",
        options: [
          { label: "Publicar", answer: "sim" },
          { label: "Tirar do ar", answer: "nao" },
        ],
      },
    },
  },

  async execute({ ctx, input, dryRun }): Promise<AstroActionResult> {
    const pickedForm = parsePickedAnswer(input.formName);
    const forms = await prisma.form.findMany({
      where: {
        organizationId: ctx.organizationId,
        ...(pickedForm.id
          ? { id: pickedForm.id }
          : { name: { contains: pickedForm.label, mode: "insensitive" } }),
      },
      select: { id: true, name: true, published: true },
      take: MAX_CANDIDATES,
    });

    if (forms.length === 0) {
      return {
        status: "needs_input",
        title: "Formulário não encontrado",
        description: `Não achei formulário com "${pickedForm.label}". Busque abaixo.`,
        missingFields: [{ key: "formName", label: "nome do formulário" }],
        appName: "Formulários",
        picker: FORM_PICKER,
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
        picker: FORM_PICKER,
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
