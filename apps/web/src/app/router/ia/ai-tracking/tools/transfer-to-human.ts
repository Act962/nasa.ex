import prisma from "@/lib/prisma";
import { tool } from "ai";
import { z } from "zod";

/**
 * Para a sessão do agente e marca como TRANSFERRED — operador humano
 * assume. Use quando:
 *  - Lead pede explicitamente pra falar com humano
 *  - Lead demonstra dúvida/situação que IA não consegue resolver
 *  - IA bateu em algum limite (mas isso é coberto pelos earlier exits do runAgentTurn)
 *  - Caso suspeito ético (menor de idade, situação delicada)
 *
 * Adiciona tag "transfer-human" ao lead pra triagem.
 * Notifica o responsável do lead via pusher (se houver).
 */
export const transferToHumanTool = (sessionId: string) =>
  tool({
    description:
      "Transfere o atendimento pra um humano e para o agente IA. Use quando lead pede pra falar com pessoa, situação delicada, ou IA não consegue resolver.",
    inputSchema: z.object({
      reason: z
        .string()
        .describe("Por que está transferindo (ex: 'Lead pediu humano')"),
      summary: z
        .string()
        .optional()
        .describe(
          "Resumo curto pra deixar pro operador entender contexto rápido",
        ),
    }),
    execute: async ({ reason, summary }) => {
      try {
        const session = await prisma.leadAgentSession.findUnique({
          where: { id: sessionId },
          select: { id: true, leadId: true, organizationId: true },
        });
        if (!session) {
          return { success: false, error: "Sessão não encontrada" };
        }

        await prisma.$transaction(async (tx) => {
          // Marca session
          await tx.leadAgentSession.update({
            where: { id: sessionId },
            data: {
              status: "TRANSFERRED",
              exitReason: "transfer_to_human",
              closedAt: new Date(),
              contextVars: {
                transferReason: reason,
                transferSummary: summary ?? null,
                transferredAt: new Date().toISOString(),
              },
            },
          });

          // Tag "transfer-human" — busca/cria
          let tag = await tx.tag.findFirst({
            where: {
              organizationId: session.organizationId,
              name: { equals: "transfer-human", mode: "insensitive" },
              archivedAt: null,
            },
            select: { id: true },
          });
          if (!tag) {
            tag = await tx.tag.create({
              data: {
                organizationId: session.organizationId,
                name: "transfer-human",
                slug: "transfer-human",
                color: "#FF6B6B",
                description: "Transferido pelo agente IA pra humano",
              },
              select: { id: true },
            });
          }

          // Anexa tag (idempotente)
          await tx.leadTag.upsert({
            where: {
              leadId_tagId: { leadId: session.leadId, tagId: tag.id },
            },
            create: { leadId: session.leadId, tagId: tag.id },
            update: {},
          });
        });

        return {
          success: true,
          message: `Sessão transferida pra humano. Motivo: ${reason}`,
        };
      } catch (err) {
        console.error("[transferToHumanTool] error:", err);
        return {
          success: false,
          error: err instanceof Error ? err.message : "Erro desconhecido",
        };
      }
    },
  });
