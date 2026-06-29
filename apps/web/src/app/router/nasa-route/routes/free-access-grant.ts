import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { isCourseManager } from "../utils";

/**
 * Concede acesso livre a um usuário (org-wide quando courseId=null,
 * ou específico de um curso).
 */
export const freeAccessGrant = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      // user pode ser identificado por id direto ou por email (mais usual no UI)
      userId: z.string().optional(),
      email: z.string().email().optional(),
      courseId: z.string().nullable().optional(),
      note: z.string().max(500).optional().nullable(),
    }).refine((d) => !!(d.userId || d.email), {
      message: "Informe userId ou email",
    }),
  )
  .handler(async ({ input, context }) => {
    const orgId = context.org.id;
    const grantedById = context.user.id;

    const ok = await isCourseManager(grantedById, orgId);
    if (!ok) {
      throw new ORPCError("FORBIDDEN", {
        message: "Apenas owner/moderador pode conceder acesso livre",
      });
    }

    // Resolve user
    const user = input.userId
      ? await prisma.user.findUnique({ where: { id: input.userId }, select: { id: true } })
      : await prisma.user.findUnique({
          where: { email: input.email! },
          select: { id: true },
        });
    if (!user) {
      throw new ORPCError("NOT_FOUND", {
        message: "Usuário não encontrado. Ele precisa estar cadastrado na plataforma.",
      });
    }

    // Se courseId informado, valida ownership
    if (input.courseId) {
      const course = await prisma.nasaRouteCourse.findUnique({
        where: { id: input.courseId },
        select: { creatorOrgId: true },
      });
      if (!course || course.creatorOrgId !== orgId) {
        throw new ORPCError("FORBIDDEN", {
          message: "Curso não pertence a esta organização",
        });
      }
    }

    const existing = await prisma.nasaRouteFreeAccess.findFirst({
      where: {
        creatorOrgId: orgId,
        userId: user.id,
        courseId: input.courseId ?? null,
      },
      select: { id: true },
    });

    const entry = existing
      ? await prisma.nasaRouteFreeAccess.update({
          where: { id: existing.id },
          data: { note: input.note ?? null, grantedById },
          select: { id: true, grantedAt: true },
        })
      : await prisma.nasaRouteFreeAccess.create({
          data: {
            creatorOrgId: orgId,
            userId: user.id,
            courseId: input.courseId ?? null,
            grantedById,
            note: input.note ?? null,
          },
          select: { id: true, grantedAt: true },
        });

    return { entry };
  });
