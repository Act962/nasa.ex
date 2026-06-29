import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { requireCourseManager } from "../utils";

/**
 * Deleta uma aula do curso. Ação destrutiva — o cliente DEVE pedir
 * confirmação digitando o nome da aula antes de chamar.
 *
 * Cascata Prisma cobre `NasaRoutePlanLesson` (relação m:n com planos)
 * e a relação `videoUploads` (registros de upload) é setada como
 * NULL via FK on-delete (preservamos o histórico de transações STARs
 * mesmo após delete da aula).
 *
 * NÃO checa enrollment ativo — diferente de delete do curso. Uma aula
 * individual pode ser removida mesmo com alunos matriculados (o curso
 * continua, só faltará aquela aula específica).
 */
export const creatorDeleteLesson = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      courseId: z.string().min(1),
      lessonId: z.string().min(1),
    }),
  )
  .handler(async ({ input, context }) => {
    await requireCourseManager(context.user.id, input.courseId);

    // Confirma que a aula pertence ao curso (evita delete cross-course).
    const lesson = await prisma.nasaRouteLesson.findUnique({
      where: { id: input.lessonId },
      select: { id: true, courseId: true, title: true },
    });
    if (!lesson || lesson.courseId !== input.courseId) {
      throw new ORPCError("NOT_FOUND", { message: "Aula não encontrada" });
    }

    await prisma.nasaRouteLesson.delete({ where: { id: input.lessonId } });
    return { ok: true, deletedTitle: lesson.title };
  });
