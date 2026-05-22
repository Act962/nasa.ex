import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { parseVideoUrl } from "../utils";

/**
 * Retorna o vídeo de uma aula apenas se ela estiver marcada como
 * `isFreePreview=true`. Usado pelo player público de preview.
 */
export const publicGetFreeLesson = base
  .input(
    z.object({
      companySlug: z.string().min(1),
      courseSlug: z.string().min(1),
      lessonId: z.string().min(1),
    }),
  )
  .handler(async ({ input }) => {
    const org = await prisma.organization.findUnique({
      where: { slug: input.companySlug },
      select: { id: true },
    });
    if (!org) throw new ORPCError("NOT_FOUND", { message: "Organização não encontrada" });

    const course = await prisma.nasaRouteCourse.findUnique({
      where: {
        creatorOrgId_slug: { creatorOrgId: org.id, slug: input.courseSlug },
      },
      select: { id: true, isPublished: true, isArchived: true, title: true },
    });
    if (!course || !course.isPublished || course.isArchived) {
      throw new ORPCError("NOT_FOUND", { message: "Curso não encontrado" });
    }

    const lesson = await prisma.nasaRouteLesson.findFirst({
      where: { id: input.lessonId, courseId: course.id },
      select: {
        id: true,
        title: true,
        summary: true,
        contentMd: true,
        videoUrl: true,
        // Vídeo hospedado no R2 NASA Route — quando setado, o front
        // renderiza com `<video>` nativo (não iframe). Pra aulas grátis
        // (isFreePreview=true) precisa expor isso publicamente.
        videoFileKey: true,
        durationMin: true,
        isFreePreview: true,
      },
    });
    if (!lesson) throw new ORPCError("NOT_FOUND", { message: "Aula não encontrada" });

    if (!lesson.isFreePreview) {
      throw new ORPCError("FORBIDDEN", {
        message: "Esta aula é exclusiva para alunos matriculados",
      });
    }

    const video = parseVideoUrl(lesson.videoUrl);

    return {
      courseTitle: course.title,
      lesson: {
        id: lesson.id,
        title: lesson.title,
        summary: lesson.summary,
        contentMd: lesson.contentMd,
        videoFileKey: lesson.videoFileKey,
        durationMin: lesson.durationMin,
        video,
      },
    };
  });
