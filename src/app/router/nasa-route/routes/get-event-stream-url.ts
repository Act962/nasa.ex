import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";

/**
 * Aluno entra no evento online.
 *
 * Regra de segurança: o `eventStreamUrl` (Zoom/Meet/YouTube) só é liberado
 * a partir de 30 minutos antes do início. Antes disso, retorna apenas a
 * data de liberação pra mostrar countdown — sem vazar a URL.
 *
 * Após o término (`eventEndsAt`), permite acesso ainda (em caso de gravação
 * pelo mesmo link). O criador deve trocar/revogar o link manualmente se
 * quiser cortar acesso.
 */
export const getEventStreamUrl = base
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
        message: "Você precisa estar inscrito no evento",
      });
    }

    // 2. Busca dados do evento
    const course = await prisma.nasaRouteCourse.findUnique({
      where: { id: input.courseId },
      select: {
        id: true,
        format: true,
        title: true,
        eventStartsAt: true,
        eventEndsAt: true,
        eventStreamUrl: true,
        eventTimezone: true,
        eventLocationNote: true,
      },
    });
    if (!course) {
      throw new ORPCError("NOT_FOUND", { message: "Evento não encontrado" });
    }
    if (course.format !== "event") {
      throw new ORPCError("BAD_REQUEST", {
        message: "Este produto não é um evento",
      });
    }
    if (!course.eventStartsAt) {
      throw new ORPCError("NOT_FOUND", {
        message: "Data do evento não definida",
      });
    }

    const now = new Date();
    const startsAt = course.eventStartsAt;
    const releaseAt = new Date(startsAt.getTime() - 30 * 60 * 1000); // -30 min
    const accessible = now >= releaseAt;

    return {
      accessible,
      streamUrl: accessible ? course.eventStreamUrl : null,
      eventStartsAt: course.eventStartsAt,
      eventEndsAt: course.eventEndsAt,
      eventTimezone: course.eventTimezone,
      eventLocationNote: course.eventLocationNote,
      releaseAt, // quando o link vai liberar
    };
  });
