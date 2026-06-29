import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { requireCourseManager } from "../utils";

/**
 * Substitui completamente o conjunto de aulas associadas a um plano.
 * Recebe a lista final de `lessonIds`; tudo que não estiver na lista é removido.
 */
export const creatorSetPlanLessons = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      planId: z.string().min(1),
      lessonIds: z.array(z.string().min(1)),
    }),
  )
  .handler(async ({ input, context }) => {
    const plan = await prisma.nasaRoutePlan.findUnique({
      where: { id: input.planId },
      select: { id: true, courseId: true },
    });
    if (!plan) {
      throw new ORPCError("NOT_FOUND", { message: "Plano não encontrado" });
    }

    await requireCourseManager(context.user.id, plan.courseId);

    // Garante que todas as aulas pertencem ao mesmo curso do plano.
    const validLessons = await prisma.nasaRouteLesson.findMany({
      where: { id: { in: input.lessonIds }, courseId: plan.courseId },
      select: { id: true },
    });
    const validIds = new Set(validLessons.map((l) => l.id));
    const filtered = input.lessonIds.filter((id) => validIds.has(id));

    await prisma.$transaction([
      prisma.nasaRoutePlanLesson.deleteMany({
        where: { planId: input.planId },
      }),
      ...(filtered.length > 0
        ? [
            prisma.nasaRoutePlanLesson.createMany({
              data: filtered.map((lessonId) => ({
                planId: input.planId,
                lessonId,
              })),
              skipDuplicates: true,
            }),
          ]
        : []),
    ]);

    return { ok: true as const, count: filtered.length };
  });
