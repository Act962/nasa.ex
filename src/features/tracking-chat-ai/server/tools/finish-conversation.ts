import { tool } from "ai";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { pusherServer } from "@/lib/pusher";
import type { AgentContext } from "../../lib/context";

export const makeFinishConversationTool = (ctx: AgentContext) =>
  tool({
    description:
      "Encerra a conversa de vez. Use quando o atendimento estiver concluído e o lead não precisar mais de assistência (resposta dada, dúvida resolvida, lead recusou). Após chamar essa tool, a IA não responderá mais até o lead voltar com nova mensagem.",
    inputSchema: z.object({
      reason: z
        .string()
        .max(200)
        .describe("Por que está encerrando — registro interno (não enviado)"),
    }),
    execute: async ({ reason }) => {
      await prisma.lead.update({
        where: { id: ctx.lead.id },
        data: { statusFlow: "FINISHED" },
      });

      await pusherServer.trigger(ctx.trackingId, "lead:updated", {
        leadId: ctx.lead.id,
      });

      return { ok: true, finishedReason: reason };
    },
  });
