import { tool } from "ai";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { pusherServer } from "@/lib/pusher";
import type { AgentContext } from "../../lib/context";

export const makeTransferToHumanTool = (ctx: AgentContext) =>
  tool({
    description:
      "Transfere o atendimento para um humano. Use quando o lead pedir explicitamente para falar com pessoa OU quando você não souber responder. Depois disso a IA fica pausada para esse lead até alguém reativar.",
    inputSchema: z.object({
      reason: z
        .string()
        .max(200)
        .describe(
          "Motivo da transferência — registro interno (não enviado ao lead)",
        ),
    }),
    execute: async ({ reason }) => {
      await prisma.lead.update({
        where: { id: ctx.lead.id },
        data: {
          isActive: false,
          statusFlow: "ACTIVE",
        },
      });

      await pusherServer.trigger(ctx.trackingId, "lead:updated", {
        leadId: ctx.lead.id,
      });

      return { ok: true, transferredReason: reason };
    },
  });
