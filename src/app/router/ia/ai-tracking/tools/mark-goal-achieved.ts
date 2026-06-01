import prisma from "@/lib/prisma";
import { tool } from "ai";
import { z } from "zod";

/**
 * Avança a `LeadAgentSession` pro próximo goal definido em `onSuccess`.
 *
 * IA chama esse tool quando o `completionCriteria` do goal atual foi
 * atingido — ex: lead confirmou interesse, aceitou proposta, escolheu
 * opção do menu.
 *
 * Se `onSuccess` for null no spec do goal atual, marca session como
 * COMPLETED com exitReason=goal_achieved.
 */
export const markGoalAchievedTool = (sessionId: string) =>
  tool({
    description:
      "Marca o objetivo atual da conversa como concluído. Avança pro próximo goal do agente OU finaliza a sessão se for o último. Use quando o lead atingiu o critério do goal atual (aceitou proposta, escolheu opção, confirmou interesse).",
    inputSchema: z.object({
      reason: z
        .string()
        .describe("Motivo curto do sucesso (ex: 'lead aceitou proposta')"),
      contextVarUpdates: z
        .record(z.string(), z.string())
        .optional()
        .describe(
          "Variáveis de contexto a salvar (produto escolhido, etc) — mescla com contextVars existente",
        ),
    }),
    execute: async ({ reason, contextVarUpdates }) => {
      try {
        const session = await prisma.leadAgentSession.findUnique({
          where: { id: sessionId },
          include: { agent: { select: { spec: true } } },
        });
        if (!session) {
          return { success: false, error: "Sessão não encontrada" };
        }

        const spec = session.agent.spec as any;
        const currentGoal = spec.goals?.find(
          (g: any) => g.id === session.currentGoalId,
        );
        const nextGoalId = currentGoal?.onSuccess ?? null;
        const isLast = !nextGoalId;

        const mergedContext = {
          ...((session.contextVars as Record<string, unknown>) ?? {}),
          ...(contextVarUpdates ?? {}),
          lastGoalAchieved: session.currentGoalId,
          lastSuccessReason: reason,
        };

        await prisma.leadAgentSession.update({
          where: { id: sessionId },
          data: {
            currentGoalId: nextGoalId,
            status: isLast ? "COMPLETED" : "ACTIVE",
            exitReason: isLast ? "goal_achieved" : null,
            closedAt: isLast ? new Date() : null,
            contextVars: mergedContext,
            // Reseta attemptCount pro novo goal — cada goal tem seu próprio loop
            attemptCount: isLast ? session.attemptCount : 0,
          },
        });

        return {
          success: true,
          completed: isLast,
          nextGoalId,
          message: isLast
            ? `Sessão concluída com sucesso: ${reason}`
            : `Avançou pro goal "${nextGoalId}": ${reason}`,
        };
      } catch (err) {
        console.error("[markGoalAchievedTool] error:", err);
        return {
          success: false,
          error: err instanceof Error ? err.message : "Erro desconhecido",
        };
      }
    },
  });
