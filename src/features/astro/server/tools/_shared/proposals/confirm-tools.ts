import "server-only";
import { tool } from "ai";
import { z } from "zod";
import prisma from "@/lib/prisma";
import type { AgentContext } from "@/features/astro/server/agents/types";
import type { AstroConfirmationResultPayload } from "@/features/astro/lib/astro-confirmation";
import { getProposalExecutor } from "./types";

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
        const pending = proposalId
          ? await prisma.astroPendingAction.findUnique({ where: { id: proposalId } })
          : await findLatestPending(ctx);

        if (!pending) {
          return { error: "Não achei nenhuma proposta pendente pra confirmar. Refaça o pedido." };
        }
        if (pending.organizationId !== ctx.organizationId || pending.userId !== ctx.userId) {
          return { error: "Essa proposta não é sua ou é de outra organização." };
        }
        if (pending.status === "CONFIRMED") {
          return {
            kind: "astro_confirmation_result",
            proposalId: pending.id,
            actionType: pending.actionType,
            ok: true,
            title: "Já executada",
            summary: "Essa proposta já tinha sido confirmada e executada — nada foi duplicado.",
          };
        }
        if (pending.status !== "PENDING") {
          return { error: `Essa proposta está ${pending.status.toLowerCase()} e não pode ser executada. Refaça o pedido.` };
        }
        if (pending.expiresAt.getTime() < Date.now()) {
          await prisma.astroPendingAction.update({
            where: { id: pending.id },
            data: { status: "EXPIRED" },
          });
          return { error: "Essa proposta expirou. Quer que eu refaça?" };
        }

        const executor = getProposalExecutor(pending.actionType);
        if (!executor) {
          return { error: `Não sei executar "${pending.actionType}".` };
        }

        try {
          const result = await executor({
            ctx,
            proposalId: pending.id,
            payload: pending.payload as Record<string, unknown>,
          });
          await prisma.astroPendingAction.update({
            where: { id: pending.id },
            data: {
              status: result.ok ? "CONFIRMED" : "FAILED",
              confirmedAt: new Date(),
              result: (result.data ?? { summary: result.summary }) as object,
              errorMessage: result.ok ? null : result.summary,
            },
          });
          return {
            kind: "astro_confirmation_result",
            proposalId: pending.id,
            actionType: pending.actionType,
            ok: result.ok,
            title: result.ok ? "Feito" : "Não deu certo",
            summary: result.summary,
            lines: result.lines,
            links: result.links,
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : "Erro ao executar";
          console.error("[astro/confirm_action] executor failed", error);
          await prisma.astroPendingAction.update({
            where: { id: pending.id },
            data: { status: "FAILED", confirmedAt: new Date(), errorMessage: message },
          });
          return { error: `Falhou ao executar: ${message}` };
        }
      },
    }),

    cancel_action: tool({
      description:
        "Cancela uma proposta pendente quando o usuário disse 'não', 'cancela', 'deixa' ou 'cancelar <id>'. Sem id, cancela a última pendente.",
      inputSchema: z.object({ proposalId: z.string().optional() }),
      execute: async ({ proposalId }) => {
        const pending = proposalId
          ? await prisma.astroPendingAction.findUnique({ where: { id: proposalId } })
          : await findLatestPending(ctx);
        if (
          !pending ||
          pending.organizationId !== ctx.organizationId ||
          pending.userId !== ctx.userId
        ) {
          return { error: "Não achei essa proposta." };
        }
        if (pending.status !== "PENDING") {
          return { success: true, summary: `Proposta já estava ${pending.status.toLowerCase()}.` };
        }
        await prisma.astroPendingAction.update({
          where: { id: pending.id },
          data: { status: "CANCELLED" },
        });
        return { success: true, summary: "Proposta cancelada. Nada foi gravado." };
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
