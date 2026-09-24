import "server-only";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { MessageStatus } from "@/generated/prisma/enums";
import type { AstroAction, AstroActionResult } from "../types";

// Marcar conversas como lidas (spec 0024, onda 1). Update local, sem rede:
// o `mark-read.ts` original também não chama o provider.

const inputSchema = z.object({
  leadName: z
    .string()
    .trim()
    .min(2)
    .optional()
    .describe("Lead de quem marcar. Sem isso, marca todas as conversas."),
});

export const markChatReadAction: AstroAction<typeof inputSchema> = {
  key: "chat.mark_read",
  toolName: "mark_chat_read",
  description:
    "Marca mensagens de conversa como lidas. " +
    "Use quando o usuário disser 'marca as conversas como lidas', " +
    "'zera o não lido', 'marca o chat do Fulano como lido'.",
  requiresConfirmation: false,
  input: inputSchema,

  async execute({ ctx, input, dryRun }): Promise<AstroActionResult> {
    const where = {
      fromMe: false,
      seen: false,
      conversation: {
        lead: {
          tracking: { organizationId: ctx.organizationId },
          ...(input.leadName
            ? { name: { contains: input.leadName, mode: "insensitive" as const } }
            : {}),
        },
      },
    };

    const pending = await prisma.message.count({ where });

    if (pending === 0) {
      return {
        status: "done",
        title: "Nada a marcar",
        description: input.leadName
          ? `Não há mensagem não lida de "${input.leadName}".`
          : "Você já está com tudo lido.",
        appName: "Chat",
      };
    }

    if (dryRun) {
      return {
        status: "done",
        title: "Marcar como lidas",
        description: `${pending} mensagem(ns) serão marcadas como lidas.`,
        appName: "Chat",
      };
    }

    await prisma.message.updateMany({
      where,
      data: { seen: true, status: MessageStatus.SEEN },
    });

    return {
      status: "done",
      title: "Conversas marcadas como lidas",
      description: `${pending} mensagem(ns) ${input.leadName ? `de "${input.leadName}" ` : ""}foram marcadas como lidas.`,
      internalUrl: "/tracking-chat",
      appName: "Chat",
    };
  },
};
