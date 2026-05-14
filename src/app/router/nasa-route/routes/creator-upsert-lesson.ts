import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { requireCourseManager, parseVideoUrl } from "../utils";

export const creatorUpsertLesson = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      id: z.string().optional(),
      courseId: z.string().min(1),
      moduleId: z.string().optional().nullable(),
      title: z.string().min(2).max(180),
      summary: z.string().max(500).optional().nullable(),
      contentMd: z.string().max(20000).optional().nullable(),
      videoUrl: z.string().min(1).optional().nullable(),
      durationMin: z.number().int().min(0).optional().nullable(),
      isFreePreview: z.boolean().default(false),
      awardSp: z.number().int().min(0).max(1000).default(10),
      order: z.number().int().min(0).optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    await requireCourseManager(context.user.id, input.courseId);

    const video = parseVideoUrl(input.videoUrl ?? null);

    if (input.id) {
      const existing = await prisma.nasaRouteLesson.findUnique({
        where: { id: input.id },
        select: { courseId: true },
      });
      if (!existing || existing.courseId !== input.courseId) {
        throw new ORPCError("NOT_FOUND", { message: "Aula não encontrada" });
      }
      // Regra "um vídeo só": se o criador define videoUrl (YouTube/Vimeo),
      // zeramos qualquer vídeo upado pro R2 (e vice-versa, via
      // creatorCompleteVideoUpload). O arquivo no R2 vira órfão até cleanup
      // manual — aceito pra v1 (raro mudar de link depois de upar).
      const clearR2Video = !!input.videoUrl;
      const updated = await prisma.nasaRouteLesson.update({
        where: { id: input.id },
        data: {
          moduleId: input.moduleId ?? null,
          title: input.title,
          summary: input.summary ?? null,
          contentMd: input.contentMd ?? null,
          videoUrl: input.videoUrl ?? null,
          videoProvider: video.provider,
          videoId: video.videoId,
          ...(clearR2Video
            ? { videoFileKey: null, videoFileSize: null }
            : {}),
          durationMin: input.durationMin ?? null,
          isFreePreview: input.isFreePreview,
          awardSp: input.awardSp,
          ...(input.order !== undefined ? { order: input.order } : {}),
        },
      });
      return { lesson: updated };
    }

    const order =
      input.order ??
      (await prisma.nasaRouteLesson.count({ where: { courseId: input.courseId } }));

    const created = await prisma.nasaRouteLesson.create({
      data: {
        courseId: input.courseId,
        moduleId: input.moduleId ?? null,
        title: input.title,
        summary: input.summary ?? null,
        contentMd: input.contentMd ?? null,
        videoUrl: input.videoUrl ?? null,
        videoProvider: video.provider,
        videoId: video.videoId,
        durationMin: input.durationMin ?? null,
        isFreePreview: input.isFreePreview,
        awardSp: input.awardSp,
        order,
      },
    });

    // Auto-vincula a aula recém-criada ao plano default do curso (se houver).
    // Os demais planos (premium, etc.) precisam ser explicitamente atualizados
    // pelo criador via o lesson-picker para incluir aulas adicionais.
    const defaultPlan = await prisma.nasaRoutePlan.findFirst({
      where: { courseId: input.courseId, isDefault: true },
      select: { id: true },
    });
    if (defaultPlan) {
      await prisma.nasaRoutePlanLesson.create({
        data: { planId: defaultPlan.id, lessonId: created.id },
      });
    }

    return { lesson: created };
  });
