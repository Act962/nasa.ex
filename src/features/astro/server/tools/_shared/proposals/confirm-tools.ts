import "server-only";
import { tool } from "ai";
import { z } from "zod";
import prisma from "@/lib/prisma";
import type { AgentContext } from "@/features/astro/server/agents/types";
import type { AstroConfirmationResultPayload } from "@/features/astro/lib/astro-confirmation";
import { cancelPendingAction, confirmPendingAction } from "./confirm-direct";

// Tools genéricas de confirmação (spec 0014, D-2). Valem para qualquer
// domínio que registre executores — não conhecem "financeiro".

// Sem id, só vale a proposta do mesmo canal: um "sim" no WhatsApp não pode
// executar o que ficou pendente no chat in-app (e vice-versa).
async function findLatestPending(ctx: AgentContext) {
  return prisma.astroPendingAction.findFirst({
    where: {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      channel: ctx.channel ?? "CHAT",
      status: "PENDING",
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });
}

export function buildProposalTools(ctx: AgentContext) {
  return {
    confirm_action: tool({
      description:
        "Executa uma proposta pendente depois que o usuário CONFIRMOU ('sim', 'confirma', 'pode', 'ok', 'confirmar <id>'). Passe o proposalId do card mais recente; sem id, executa a última proposta pendente do usuário. NUNCA chame sem o usuário ter confirmado explicitamente.",
      inputSchema: z.object({
        proposalId: z
          .string()
          .optional()
          .describe("ID da proposta (vem no payload astro_confirmation). Omita pra usar a última pendente."),
      }),
      execute: async ({ proposalId }): Promise<AstroConfirmationResultPayload | { error: string }> => {
        // A regra mora em `confirm-direct.ts`, compartilhada com o clique no
        // cartão, que executa sem passar por modelo nenhum (spec 0032, D-4).
        const outcome = await confirmPendingAction({ ctx, proposalId });
        return outcome.ok ? outcome.payload : { error: outcome.error };
      },
    }),

    cancel_action: tool({
      description:
        "Cancela uma proposta pendente quando o usuário disse 'não', 'cancela', 'deixa' ou 'cancelar <id>'. Sem id, cancela a última pendente.",
      inputSchema: z.object({ proposalId: z.string().optional() }),
      execute: async ({ proposalId }) => {
        const outcome = await cancelPendingAction({ ctx, proposalId });
        return "error" in outcome ? outcome : { success: true, summary: outcome.summary };
      },
    }),

    list_pending_actions: tool({
      description:
        "Lista as propostas pendentes do usuário (ainda não confirmadas nem expiradas). Use quando ele perguntar 'o que estava pendente?' ou quando o histórico perdeu o id.",
      inputSchema: z.object({}),
      execute: async () => {
        const pendings = await prisma.astroPendingAction.findMany({
          where: {
            organizationId: ctx.organizationId,
            userId: ctx.userId,
            status: "PENDING",
            expiresAt: { gt: new Date() },
          },
          orderBy: { createdAt: "desc" },
          take: 10,
          select: { id: true, actionType: true, summary: true, expiresAt: true },
        });
        return {
          pendings: pendings.map((pending) => ({
            proposalId: pending.id,
            actionType: pending.actionType,
            summary: pending.summary,
            expiresAt: pending.expiresAt.toISOString(),
          })),
        };
      },
    }),
  };
}
