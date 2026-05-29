import prisma from "@/lib/prisma";
import { tool } from "ai";
import { z } from "zod";

/**
 * Agenda próximo follow-up explícito da `LeadAgentSession`.
 *
 * IA pode chamar pra:
 *  - Override do followUpSchedule default (ex: "lead pediu pra voltar em 2 dias")
 *  - Curto cooldown ("retomar amanhã cedo")
 *  - Adiamento depois de algum compromisso ("vou viajar, fala comigo dia 30")
 *
 * Move session pra status=WAITING e nextActionAt=now+days.
 * O Inngest scheduler vai acordar nesse momento.
 *
 * Importante: não incrementa attemptCount — esse é um override manual,
 * não conta como tentativa do loop automático.
 */
export const scheduleFollowUpTool = (sessionId: string) =>
  tool({
    description:
      "Agenda quando voltar a tentar conversar com o lead. Use quando o lead pedir tempo ou marcar pra continuar depois. Não conta como tentativa automática.",
    inputSchema: z.object({
      daysFromNow: z
        .number()
        .int()
        .positive()
        .max(60)
        .describe(
          "Quantos dias a partir de agora pra reabordar (1-60). Ex: 2 = retomar em 2 dias",
        ),
      reason: z
        .string()
        .describe(
          "Por que agendar (ex: 'lead vai viajar, pediu pra voltar dia 30')",
        ),
    }),
    execute: async ({ daysFromNow, reason }) => {
      try {
        const session = await prisma.leadAgentSession.findUnique({
          where: { id: sessionId },
          select: { id: true, status: true },
        });
        if (!session) {
          return { success: false, error: "Sessão não encontrada" };
        }
        if (
          session.status === "COMPLETED" ||
          session.status === "TRANSFERRED"
        ) {
          return {
            success: false,
            error: `Sessão já está em estado terminal (${session.status})`,
          };
        }

        const nextAt = new Date();
        nextAt.setDate(nextAt.getDate() + daysFromNow);

        await prisma.leadAgentSession.update({
          where: { id: sessionId },
          data: {
            status: "WAITING",
            nextActionAt: nextAt,
            lastActionAt: new Date(),
            contextVars: {
              lastScheduleReason: reason,
              lastScheduledAt: new Date().toISOString(),
            },
          },
        });

        return {
          success: true,
          message: `Follow-up agendado pra ${nextAt.toISOString()}. Motivo: ${reason}`,
        };
      } catch (err) {
        console.error("[scheduleFollowUpTool] error:", err);
        return {
          success: false,
          error: err instanceof Error ? err.message : "Erro desconhecido",
        };
      }
    },
  });
