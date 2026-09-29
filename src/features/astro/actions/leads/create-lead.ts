import "server-only";
import { z } from "zod";
import prisma from "@/lib/prisma";
import type { AstroAction, AstroActionResult } from "../types";
import { resolveSingleTracking } from "../tracking/resolve-tracking";
import {
  TRACKING_FIELD_STEP,
  extractEmail,
  extractPhone,
  extractTrackingName,
  isSkipAnswer,
} from "./lead-steps";

// Criar lead (spec 0024). O verbo mais óbvio do catálogo era justamente o que
// faltava: "quero criar um lead" caía em `lead.add_note`, porque era a ação
// mais parecida que o app tracking oferecia, e o pedido acabava criando
// coluna. Verbo ausente não vira "não sei" — vira o vizinho errado.

/** Nome depois de "lead", "contato" ou "cliente", até o primeiro dado seguinte. */
function extractNewLeadName(text: string): string | undefined {
  const match = text.match(
    /\b(?:lead|contato|cliente)\s+(?:chamad[oa]\s+)?(.+?)(?=\s*,|\s+(?:telefone|tel|fone|celular|whats\w*|e-?mail|no funil|no tracking|na coluna|com o telefone)\b|$)/iu,
  );
  const name = match?.[1]?.trim().replace(/[.!?]+$/, "");
  return name && name.length >= 2 && !/^(novo|nova|um|uma)$/i.test(name) ? name : undefined;
}

function inferNewLeadFields(text: string): Record<string, unknown> {
  const inferred: Record<string, unknown> = {};
  const leadName = extractNewLeadName(text);
  if (leadName) inferred.leadName = leadName;
  const phone = extractPhone(text);
  if (phone) inferred.phone = phone;
  const email = extractEmail(text);
  if (email) inferred.email = email;
  const trackingName = extractTrackingName(text);
  if (trackingName) inferred.trackingName = trackingName;
  return inferred;
}

const PHONE_DIGITS_MIN = 10;
const PHONE_DIGITS_MAX = 13;

const inputSchema = z.object({
  leadName: z.string().trim().min(2).max(120).describe("Nome do lead a criar."),
  phone: z
    .string()
    .trim()
    .max(40)
    .optional()
    .describe("Telefone com DDD, quando o usuário disser."),
  email: z.string().trim().max(160).optional().describe("E-mail, quando dito."),
  trackingName: z
    .string()
    .trim()
    .min(2)
    .optional()
    .describe("Funil onde o lead entra. Sem isso, usa o único da organização."),
});

export const createLeadAction: AstroAction<typeof inputSchema> = {
  key: "lead.create",
  app: "leads",
  toolName: "create_lead_in_tracking",
  description:
    "Cria um CLIENTE novo no funil — 'cria um lead', 'cadastra o Fulano', 'novo contato Fulano'. " +
    "É sobre alguém de fora da empresa que ainda não está no sistema. " +
    "Não serve para anotar em lead existente nem para dar acesso a colega de equipe.",
  permission: { appKey: "tracking", action: "create" },
  requiresConfirmation: false,
  newNameFields: ["leadName"],
  input: inputSchema,
  inferFields: inferNewLeadFields,
  intentPatterns: [
    /\b(cria|criar|crie|cadastra|cadastrar|cadastre)\s+(um|uma|o|a)?\s*(novo\s+|nova\s+)?(lead|contato|cliente)\b/,
    /\b(novo|nova)\s+(lead|contato|cliente)\b/,
  ],
  fieldSteps: {
    leadName: {
      title: "Nome do lead",
      question: "Qual o nome do lead?",
      picker: { kind: "text", placeholder: "Ex.: Maria Clara", maxLength: 120 },
    },
    trackingName: TRACKING_FIELD_STEP,
  },

  async execute({ ctx, input, dryRun }): Promise<AstroActionResult> {
    const resolved = await resolveSingleTracking({
      ctx,
      name: input.trackingName,
      field: "trackingName",
    });
    if ("failure" in resolved) return resolved.failure;
    const tracking = resolved.tracking;

    const firstStatus = await prisma.status.findFirst({
      where: { trackingId: tracking.id },
      orderBy: { order: "asc" },
      select: { id: true, name: true },
    });
    if (!firstStatus) {
      return {
        status: "error",
        title: "Funil sem colunas",
        description: `O tracking ${tracking.name} não tem nenhuma coluna. Crie a primeira etapa antes.`,
        internalUrl: `/tracking/${tracking.id}/settings`,
        appName: "Tracking",
      };
    }

    // Telefone é o que liga o lead ao WhatsApp: pergunta, mas deixa pular.
    if (input.phone === undefined) {
      return {
        status: "needs_input",
        title: "Telefone",
        description: `Qual o telefone de ${input.leadName}, com DDD?`,
        missingFields: [{ key: "phone", label: "o telefone" }],
        appName: "Tracking",
        picker: {
          kind: "text",
          placeholder: "(86) 99999-0000",
          maxLength: 40,
          skipOption: { label: "Sem telefone", answer: "sem telefone" },
        },
      };
    }
    const isPhoneSkipped = isSkipAnswer(input.phone);
    const phoneDigits = isPhoneSkipped ? "" : input.phone.replace(/\D/g, "");
    if (!isPhoneSkipped && (phoneDigits.length < PHONE_DIGITS_MIN || phoneDigits.length > PHONE_DIGITS_MAX)) {
      return {
        status: "needs_input",
        title: "Telefone inválido",
        description: `"${input.phone}" não parece um telefone. Digite com DDD.`,
        missingFields: [{ key: "phone", label: "o telefone" }],
        appName: "Tracking",
        picker: {
          kind: "text",
          placeholder: "(86) 99999-0000",
          maxLength: 40,
          skipOption: { label: "Sem telefone", answer: "sem telefone" },
        },
      };
    }
    const phone = isPhoneSkipped ? null : phoneDigits.length <= 11 ? `55${phoneDigits}` : phoneDigits;

    const duplicate = await prisma.lead.findFirst({
      where: {
        trackingId: tracking.id,
        name: { equals: input.leadName, mode: "insensitive" },
      },
      select: { id: true },
    });
    if (duplicate) {
      return {
        status: "error",
        title: "Lead já existe",
        description: `Já existe "${input.leadName}" em ${tracking.name}.`,
        internalUrl: `/contatos/${duplicate.id}`,
        openLabel: "Abrir lead",
        appName: "Tracking",
      };
    }

    if (dryRun) {
      return {
        status: "done",
        title: "Criar lead",
        description: `"${input.leadName}" entrará em ${tracking.name}, na coluna "${firstStatus.name}"${phone ? `, telefone ${phone}` : ""}.`,
        appName: "Tracking",
      };
    }

    const lead = await prisma.lead.create({
      data: {
        name: input.leadName,
        phone,
        email: input.email ?? null,
        trackingId: tracking.id,
        statusId: firstStatus.id,
        responsibleId: ctx.userId,
      },
      select: { id: true, name: true },
    });

    return {
      status: "done",
      title: "Lead criado",
      description: `${lead.name} entrou em ${tracking.name}, na coluna "${firstStatus.name}"${phone ? `, telefone ${phone}` : ""}.`,
      internalUrl: `/contatos/${lead.id}`,
      openLabel: "Abrir lead",
      appName: "Tracking",
    };
  },
};
