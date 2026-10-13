import { tool } from "ai";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { pusherServer } from "@/lib/pusher";
import type { AgentContext } from "../../lib/context";
import { signalLeadAwaitingHuman } from "../../lib/awaiting-human";

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
        clientAsked: z
        .boolean()
        .optional()
        .describe("true quando o próprio cliente pediu uma pessoa; false quando você não conseguiu resolver."),
    }),
    execute: async ({ reason, clientAsked }) => {
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

      await signalLeadAwaitingHuman({
        organizationId: ctx.organizationId,
        leadId: ctx.lead.id,
        conversationId: ctx.conversation.id,
        reason: clientAsked === false ? "assistant_could_not_solve" : "client_asked",
      });

      return { ok: true, transferredReason: reason };
    },
  });
