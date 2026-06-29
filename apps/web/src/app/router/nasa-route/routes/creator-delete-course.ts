import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { requireCourseManager } from "../utils";

/** Deleta curso (cascata cobre módulos, aulas, enrollments, progress, free-access). */
export const creatorDeleteCourse = base
  .use(requiredAuthMiddleware)
  .input(z.object({ courseId: z.string().min(1) }))
  .handler(async ({ input, context }) => {
    await requireCourseManager(context.user.id, input.courseId);

    const enrollmentCount = await prisma.nasaRouteEnrollment.count({
      where: { courseId: input.courseId, status: "active" },
    });
    if (enrollmentCount > 0) {
      throw new ORPCError("BAD_REQUEST", {
        message: `Não é possível excluir um curso com ${enrollmentCount} matrículas ativas. Despublique-o em vez disso.`,
      });
    }

    await prisma.nasaRouteCourse.delete({ where: { id: input.courseId } });
    return { ok: true };
  });
