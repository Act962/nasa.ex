import "server-only";
import { z } from "zod";
import prisma from "@/lib/prisma";
import type { AstroAction, AstroActionResult } from "../types";
import { resolveSingleLead } from "./resolve-lead";
import { LEAD_FIELD_STEP, extractNameAfter } from "./lead-steps";
import { parsePickedAnswer } from "@/features/astro/lib/astro-picker";
import { normalizeQuestion } from "@/features/astro/queries/types";

// Aplicar tag existente a um lead. "Cria o lead X, coloca a tag Quente e move
// para Qualificado" (F5-LEAD-01) perdia a tag: não havia verbo para ela.

const MAX_TAG_OPTIONS = 8;

/** "coloca a tag Quente no Kauê" → tag e lead, sem modelo. */
function inferLeadTagFields(text: string): Record<string, unknown> {
  const inferred: Record<string, unknown> = {};
  const tagName = text.match(/\b(?:tag|etiqueta)\s+["“]?([\wÀ-ÿ][\wÀ-ÿ ]*?)["”]?(?=\s+(?:no|na|ao|para|pro|pra|em)\b|[,.!?]|$)/iu)?.[1];
  if (tagName) inferred.tagName = tagName.trim();
  const leadName = extractNameAfter(text, ["no", "na", "ao", "para", "pro", "pra", "em"]);
  if (leadName) inferred.leadName = leadName;
  return inferred;
}

const inputSchema = z.object({
  leadName: z.string().trim().min(2).describe("Nome do lead que recebe a tag."),
  tagName: z.string().trim().min(2).describe("Nome da tag já cadastrada."),
});

export const addLeadTagAction: AstroAction<typeof inputSchema> = {
  key: "lead.add_tag",
  app: "tracking",
  toolName: "add_tag_to_lead",
  description:
    "Aplica uma tag já cadastrada a um lead. " +
    "Use quando o usuário disser 'coloca a tag Quente no Fulano', 'marca o Fulano com a tag X'.",
  permission: { appKey: "tracking", action: "edit" },
  requiresConfirmation: false,
  input: inputSchema,
  inferFields: inferLeadTagFields,
  intentPatterns: [
    /^(?!.*\b(cria|criar|crie|nova|novo)\s+(uma\s+|a\s+)?(nova\s+)?(tag|etiqueta)\b).*\b(coloca|colocar|coloque|poe|ponha|adiciona|adicionar|adicione|aplica|aplicar|aplique|bota|botar)\b.{0,20}\b(tag|etiqueta)\b/,
  ],
  fieldSteps: {
    leadName: { ...LEAD_FIELD_STEP, title: "Em qual lead?" },
    tagName: {
      title: "Qual tag?",
      question: "Nome da tag cadastrada.",
      picker: { kind: "text", placeholder: "Ex.: Quente", maxLength: 40 },
    },
  },

  async execute({ ctx, input, dryRun }): Promise<AstroActionResult> {
    const resolved = await resolveSingleLead({
      ctx,
      name: input.leadName,
      field: "leadName",
      appName: "Tracking",
    });
    if ("failure" in resolved) return resolved.failure;
    const lead = resolved.lead;

    const tags = await prisma.tag.findMany({
      where: { organizationId: ctx.organizationId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    const picked = parsePickedAnswer(input.tagName);
    const wanted = normalizeQuestion(picked.label);
    const matches = picked.id
      ? tags.filter((tag) => tag.id === picked.id)
      : tags.filter((tag) => normalizeQuestion(tag.name) === wanted);
    const tag = matches.length === 1
      ? matches[0]
      : tags.find((tag) => normalizeQuestion(tag.name).includes(wanted));

    if (!tag) {
      return {
        status: "ambiguous",
        title: "Qual tag?",
        description: `Não achei a tag "${picked.label}". Escolha uma das cadastradas.`,
        field: "tagName",
        options: tags.slice(0, MAX_TAG_OPTIONS).map((option) => ({ id: option.id, label: option.name })),
        appName: "Tracking",
      };
    }

    if (dryRun) {
      return {
        status: "done",
        title: "Aplicar tag",
        description: `A tag "${tag.name}" vai para ${lead.name}.`,
        appName: "Tracking",
      };
    }

    await prisma.leadTag.upsert({
      where: { leadId_tagId: { leadId: lead.id, tagId: tag.id } },
      create: { leadId: lead.id, tagId: tag.id },
      update: {},
    });

    return {
      status: "done",
      title: "Tag aplicada",
      description: `${lead.name} agora tem a tag "${tag.name}".`,
      appName: "Tracking",
    };
  },
};
