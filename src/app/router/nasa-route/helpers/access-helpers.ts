import { ORPCError } from "@orpc/server";
import prisma from "@/lib/prisma";

/**
 * Verifica se o usuário tem matrícula ativa no curso. Lança FORBIDDEN
 * se: enrollment não existe, está com `status != "active"`, ou — para
 * cursos no formato `subscription` — a assinatura vinculada não está
 * em estado ativo.
 *
 * Retorna o enrollment carregado. Quando o curso é subscription, também
 * devolve o snapshot da assinatura para uso opcional pelo chamador.
 *
 * Use este helper em qualquer procedure que devolva conteúdo restrito:
 * vídeos, ebooks, links de streaming/comunidade, marcar progresso, etc.
 * Centralizar evita o gap atual de procedures que checavam só existência.
 */
export async function verifyEnrollmentActive(
  userId: string,
  courseId: string,
) {
  const enrollment = await prisma.nasaRouteEnrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
    select: {
      id: true,
      status: true,
      source: true,
      planId: true,
      enrolledAt: true,
      completedAt: true,
      buyerOrgId: true,
      subscription: {
        select: { id: true, status: true, nextChargeAt: true, currentPeriodEnd: true },
      },
    },
  });

  if (!enrollment || enrollment.status !== "active") {
    throw new ORPCError("FORBIDDEN", {
      message: "Você ainda não está matriculado neste curso",
    });
  }

  if (enrollment.subscription && enrollment.subscription.status !== "active") {
    throw new ORPCError("FORBIDDEN", {
      message: "Sua assinatura não está ativa",
    });
  }

  return enrollment;
}
