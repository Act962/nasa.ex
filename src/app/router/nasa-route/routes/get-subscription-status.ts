import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";

/**
 * Retorna o estado da assinatura do aluno num curso `subscription`.
 *
 * Mostra: status, próxima cobrança, último débito, contador de falhas.
 * O viewer usa pra renderizar o card de "Assinatura ativa até X" ou
 * o alerta de "Pagamento atrasado".
 */
export const getSubscriptionStatus = base
  .use(requiredAuthMiddleware)
  .input(z.object({ courseId: z.string().min(1) }))
  .handler(async ({ input, context }) => {
    const userId = context.user.id;

    const enrollment = await prisma.nasaRouteEnrollment.findUnique({
      where: { userId_courseId: { userId, courseId: input.courseId } },
      select: {
        id: true,
        status: true,
        subscription: {
          select: {
            id: true,
            status: true,
            startedAt: true,
            currentPeriodStart: true,
            currentPeriodEnd: true,
            nextChargeAt: true,
            lastChargedAt: true,
            failedChargeCount: true,
            cancelledAt: true,
            cancelReason: true,
          },
        },
      },
    });

    if (!enrollment) {
      throw new ORPCError("NOT_FOUND", { message: "Matrícula não encontrada" });
    }
    if (!enrollment.subscription) {
      throw new ORPCError("NOT_FOUND", {
        message: "Esta matrícula não tem assinatura ativa",
      });
    }

    return enrollment.subscription;
  });
