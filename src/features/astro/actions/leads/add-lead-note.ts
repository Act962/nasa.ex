import "server-only";
import { z } from "zod";
import prisma from "@/lib/prisma";
import type { AstroAction, AstroActionResult } from "../types";
import { resolveSingleLead } from "./resolve-lead";
import { LEAD_FIELD_STEP, extractNameAfter } from "./lead-steps";

/** "anota na Maria Clara que pediu desconto" → lead e nota, sem modelo. */
function inferNoteFields(text: string): Record<string, unknown> {
  const inferred: Record<string, unknown> = {};
  const leadName = extractNameAfter(text, ["no", "na", "do", "da"]);
  if (leadName) inferred.leadName = leadName;
  const note = text.match(/\bque\s+(.{2,})$/iu)?.[1]?.trim();
  if (note) inferred.note = note;
  return inferred;
}

// Anotar no lead (spec 0024, onda 1). Vira uma linha de `LeadHistory`, a
// mesma que a timeline do lead já lê — não é campo novo nem lugar paralelo.
//
// Não pede confirmação: anotação é aditiva e visível na hora. Confirmar cada
// nota transformaria o verbo mais usado no mais chato.

const inputSchema = z.object({
  leadName: z.string().trim().min(2).describe("Nome do lead. Pode ser parcial."),
  note: z
    .string()
    .trim()
    .min(2)
    .max(2000)
    .describe("O que anotar, com as palavras do usuário."),
});

export const addLeadNoteAction: AstroAction<typeof inputSchema> = {
  key: "lead.add_note",
  app: "leads",
  toolName: "add_lead_note",
  description:
    "Registra uma anotação na timeline de um lead que JÁ existe. Não cria lead. " +
    "Use quando o usuário disser 'anota no Fulano que...', 'registra que o Fulano pediu...', " +
    "'adiciona uma observação no Fulano'.",
  permission: { appKey: "tracking", action: "create" },
  requiresConfirmation: false,
  input: inputSchema,
  inferFields: inferNoteFields,
  intentPatterns: [
    /\b(anota|anotar|anote)\b/,
    /\b(adiciona|adicionar|adicione|coloca|colocar|coloque|inclui|incluir)\s+(uma\s+)?(nota|observacao|anotacao)\b/,
  ],
  fieldSteps: {
    leadName: LEAD_FIELD_STEP,
    note: {
      title: "O que anotar?",
      question: "Escreva a anotação.",
      picker: { kind: "text", placeholder: "Ex.: pediu desconto de 5%", maxLength: 2000 },
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

    if (dryRun) {
      return {
        status: "done",
        title: "Anotar no lead",
        description: `A nota será registrada em "${lead.name}".`,
        appName: "Tracking",
      };
    }

    await prisma.leadHistory.create({
      data: {
        notes: input.note,
        action: "ACTIVE",
        lead: { connect: { id: lead.id } },
        user: { connect: { id: ctx.userId } },
      },
    });

    return {
      status: "done",
      title: "Anotação registrada",
      description: `Anotei em "${lead.name}": ${input.note}`,
      internalUrl: `/contatos/${lead.id}`,
      appName: "Tracking",
    };
  },
};
