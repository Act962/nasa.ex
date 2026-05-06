import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";

/**
 * Aluno pega o link de convite da comunidade depois de comprado.
 *
 * Pré-requisitos:
 * 1. Usuário autenticado.
 * 2. Matrícula ativa.
 * 3. Curso é do formato `community` e tem `communityInviteUrl`.
 *
 * Retorna o link + tipo + regras. O link nunca aparece em HTML público
 * — só vem por essa procedure após auth.
 */
export const getCommunityInvite = base
  .use(requiredAuthMiddleware)
  .input(z.object({ courseId: z.string().min(1) }))
  .handler(async ({ input, context }) => {
    const userId = context.user.id;

    // 1. Verifica matrícula ativa
    const enrollment = await prisma.nasaRouteEnrollment.findUnique({
      where: { userId_courseId: { userId, courseId: input.courseId } },
      select: { id: true, status: true },
    });
    if (!enrollment || enrollment.status !== "active") {
      throw new ORPCError("FORBIDDEN", {
        message: "Você precisa entrar na comunidade primeiro",
      });
    }

    // 2. Busca dados da comunidade
    const course = await prisma.nasaRouteCourse.findUnique({
      where: { id: input.courseId },
      select: {
        id: true,
        format: true,
        communityType: true,
        communityInviteUrl: true,
        communityRules: true,
      },
    });
    if (!course) {
      throw new ORPCError("NOT_FOUND", { message: "Comunidade não encontrada" });
    }
    if (course.format !== "community") {
      throw new ORPCError("BAD_REQUEST", {
        message: "Este produto não é uma comunidade",
      });
    }
    if (!course.communityInviteUrl) {
      throw new ORPCError("NOT_FOUND", {
        message:
          "Link de convite ainda não disponível. Entre em contato com o criador.",
      });
    }

    return {
      type: course.communityType,
      inviteUrl: course.communityInviteUrl,
      rules: course.communityRules,
    };
  });
