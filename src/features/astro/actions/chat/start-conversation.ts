import "server-only";
import { z } from "zod";
import prisma from "@/lib/prisma";
import type { AstroAction, AstroActionResult } from "../types";
import { resolveSingleTracking } from "../tracking/resolve-tracking";

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
  requiresConfirmation: true,
  confirmTitle: "Abrir conversa",
  input: inputSchema,

  async execute({ ctx, input, dryRun }): Promise<AstroActionResult> {
    const phone = input.phone.replace(/\D/g, "");
    if (phone.length < PHONE_MIN_DIGITS) {
      return {
        status: "needs_input",
        title: "Telefone incompleto",
        description: `"${input.phone}" não parece um telefone com DDD.`,
        missingFields: [{ key: "phone", label: "telefone com DDD" }],
        appName: "Chat",
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
      data: { leadId: lead.id },
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
