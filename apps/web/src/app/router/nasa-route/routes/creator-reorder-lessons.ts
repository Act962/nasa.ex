import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { requireCourseManager } from "../utils";

/** Reordena aulas e (opcionalmente) o módulo de cada uma. */
export const creatorReorderLessons = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      courseId: z.string().min(1),
      lessons: z.array(
        z.object({
          id: z.string().min(1),
          order: z.number().int().min(0),
          moduleId: z.string().nullable().optional(),
        }),
      ).min(1),
    }),
  )
  .handler(async ({ input, context }) => {
    await requireCourseManager(context.user.id, input.courseId);

    await prisma.$transaction(
      input.lessons.map((l) =>
        prisma.nasaRouteLesson.update({
          where: { id: l.id },
          data: {
            order: l.order,
            ...(l.moduleId !== undefined ? { moduleId: l.moduleId } : {}),
          },
        }),
      ),
    );
    return { ok: true };
  });
