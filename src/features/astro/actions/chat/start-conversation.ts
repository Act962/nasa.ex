import "server-only";
import { z } from "zod";
import prisma from "@/lib/prisma";
import type { AstroAction, AstroActionResult } from "../types";
import { resolveSingleTracking } from "../tracking/resolve-tracking";
import { extractNameAfter, extractPhone, extractTrackingName } from "../leads/lead-steps";

/** "abre conversa com o 86 99999-9999 da Maria no funil Vendas" → campos, sem modelo. */
function inferConversationFields(text: string): Record<string, unknown> {
  const inferred: Record<string, unknown> = {};
  const phone = extractPhone(text);
  if (phone) inferred.phone = phone;
  const name = extractNameAfter(text, ["da", "do", "com"]);
  if (name) inferred.name = name;
  const trackingName = extractTrackingName(text);
  if (trackingName) inferred.trackingName = trackingName;
  return inferred;
}

// Abrir conversa a partir de um número (spec 0024, onda 1).
//
// ⚠️ NÃO VERIFICADO EM EXECUÇÃO — escrito antes de haver instância de WhatsApp
// conectada no ambiente. A lógica espelha `conversation/start-by-phone.ts`,
// mas sem a validação de existência no WhatsApp, que exige chamada ao
// provider. Testar assim que houver instância (ver changelog da spec 0024).

const PHONE_MIN_DIGITS = 10;

const inputSchema = z.object({
  phone: z
    .string()
    .trim()
    .min(PHONE_MIN_DIGITS)
    .describe("Telefone com DDD. Aceita formatação — os dígitos são extraídos."),
  name: z
    .string()
    .trim()
    .min(2)
    .optional()
    .describe("Nome de quem atende o número, quando o usuário disser."),
  trackingName: z
    .string()
    .trim()
    .optional()
    .describe("Tracking onde abrir. Sem isso, usa o único da organização."),
});

export const startConversationAction: AstroAction<typeof inputSchema> = {
  key: "chat.start_conversation",
  app: "chat",
  toolName: "start_conversation",
  description:
    "Abre uma conversa com um número de telefone, criando o lead se não existir. " +
    "Use quando o usuário disser 'abre conversa com o 86 99999-9999', " +
    "'inicia um chat com esse número'.",
  permission: { appKey: "chat", action: "create" },
  requiresConfirmation: true,
  confirmTitle: "Abrir conversa",
  input: inputSchema,
  inferFields: inferConversationFields,
  intentPatterns: [/\b(abre|abrir|abra|inicia|iniciar|inicie|comeca|comecar|comece)\s+(uma\s+)?(nova\s+)?(conversa|chat)\b/],
  fieldSteps: {
    phone: {
      title: "Qual telefone?",
      question: "Com qual número eu abro a conversa?",
      picker: { kind: "text", placeholder: "(86) 99999-0000", maxLength: 40 },
    },
  },

  async execute({ ctx, input, dryRun }): Promise<AstroActionResult> {
    // Número sem o 55 não é entregue pelo WhatsApp; os leads da base já têm.
    const digits = input.phone.replace(/\D/g, "");
    const phone = digits.length <= 11 ? `55${digits}` : digits;
    if (digits.length < PHONE_MIN_DIGITS) {
      return {
        status: "needs_input",
        title: "Telefone incompleto",
        description: `"${input.phone}" não parece um telefone com DDD.`,
        missingFields: [{ key: "phone", label: "telefone com DDD" }],
        appName: "Chat",
        picker: { kind: "text", placeholder: "(86) 99999-0000", maxLength: 40 },
      };
    }

    const resolved = await resolveSingleTracking({
      ctx,
      name: input.trackingName,
      field: "trackingName",
    });
    if ("failure" in resolved) return resolved.failure;
    const tracking = resolved.tracking;

    const existing = await prisma.lead.findFirst({
      where: { phone, trackingId: tracking.id },
      select: { id: true, name: true, conversation: { select: { id: true } } },
    });

    if (existing?.conversation) {
      return {
        status: "done",
        title: "Conversa já existe",
        description: `Já havia conversa com ${existing.name}. Abri a existente.`,
        internalUrl: `/tracking-chat/${existing.conversation.id}`,
        appName: "Chat",
      };
    }

    if (dryRun) {
      return {
        status: "done",
        title: "Abrir conversa",
        description:
          `Conversa com ${input.name ?? phone} será aberta no tracking ${tracking.name}` +
          (existing ? "." : ", criando o lead."),
        appName: "Chat",
      };
    }

    const firstStatus = await prisma.status.findFirst({
      where: { trackingId: tracking.id },
      orderBy: { order: "asc" },
      select: { id: true },
    });
    if (!firstStatus) {
      return {
        status: "error",
        title: "Tracking sem colunas",
        description: `${tracking.name} não tem nenhuma coluna — crie uma antes.`,
        appName: "Chat",
      };
    }

    const lead =
      existing ??
      (await prisma.lead.create({
        data: {
          name: input.name ?? phone,
          phone,
          trackingId: tracking.id,
          statusId: firstStatus.id,
        },
        select: { id: true, name: true },
      }));

    const conversation = await prisma.conversation.create({
      data: {
        leadId: lead.id,
        trackingId: tracking.id,
        remoteJid: `${phone}@s.whatsapp.net`,
      },
      select: { id: true },
    });

    return {
      status: "done",
      title: "Conversa aberta",
      description: `Conversa com ${lead.name} criada no tracking ${tracking.name}.`,
      internalUrl: `/tracking-chat/${conversation.id}`,
      appName: "Chat",
    };
  },
};
