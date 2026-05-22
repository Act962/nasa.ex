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
      // Chave S3 da thumbnail da aula (bucket principal, não o video bucket).
      // Opcional — UI mostra placeholder se null.
      thumbnailKey: z.string().min(1).optional().nullable(),
      durationMin: z.number().int().min(0).optional().nullable(),
      isFreePreview: z.boolean().default(false),
      awardSp: z.number().int().min(0).max(1000).default(10),
      order: z.number().int().min(0).optional(),
      // Anexos complementares da aula — PDFs, imagens, docs, planilhas
      // (kind="file"/"image") ou URL externa (kind="link"). Sync
      // completa: o array enviado SUBSTITUI o atual (criar/atualizar/
      // deletar tudo num único save). Vazio = remove todos.
      attachments: z
        .array(
          z.object({
            id: z.string().optional(), // se vier, faz update; senão, cria novo
            kind: z.enum(["file", "image", "link"]),
            title: z.string().min(1).max(200),
            url: z.string().optional().nullable(),
            fileKey: z.string().optional().nullable(),
            fileName: z.string().optional().nullable(),
            fileSize: z.number().int().min(0).optional().nullable(),
            mimeType: z.string().optional().nullable(),
            description: z.string().max(500).optional().nullable(),
            order: z.number().int().min(0).default(0),
          }),
        )
        .optional(),
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
          thumbnailKey: input.thumbnailKey ?? null,
          durationMin: input.durationMin ?? null,
          isFreePreview: input.isFreePreview,
          awardSp: input.awardSp,
          ...(input.order !== undefined ? { order: input.order } : {}),
        },
      });

      // Sync attachments — substitui todos pelo array recebido. Lógica:
      //  - Items COM `id` que ainda estão no array → UPDATE (preserva FK).
      //  - Items SEM `id` → CREATE (novos uploads).
      //  - Items que NÃO estão no array mas estão no DB → DELETE.
      if (input.attachments !== undefined) {
        await syncLessonAttachments(input.id, input.attachments);
      }

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
        thumbnailKey: input.thumbnailKey ?? null,
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

    // Cria attachments da aula recém-criada (se vieram no payload).
    if (input.attachments && input.attachments.length > 0) {
      await syncLessonAttachments(created.id, input.attachments);
    }

    return { lesson: created };
  });

/**
 * Sincroniza attachments da aula com o array recebido. Faz diff
 * (CREATE/UPDATE/DELETE) atomicamente. Items com `id` que sumiram
 * do array são removidos. Items novos (sem id) são criados.
 */
async function syncLessonAttachments(
  lessonId: string,
  attachments: Array<{
    id?: string;
    kind: "file" | "image" | "link";
    title: string;
    url?: string | null;
    fileKey?: string | null;
    fileName?: string | null;
    fileSize?: number | null;
    mimeType?: string | null;
    description?: string | null;
    order: number;
  }>,
) {
  const existing = await prisma.nasaRouteLessonAttachment.findMany({
    where: { lessonId },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((a) => a.id));
  const incomingIds = new Set(
    attachments.filter((a) => a.id).map((a) => a.id as string),
  );

  // DELETE: ids que existiam mas não vieram no payload.
  const toDelete = [...existingIds].filter((id) => !incomingIds.has(id));
  if (toDelete.length > 0) {
    await prisma.nasaRouteLessonAttachment.deleteMany({
      where: { id: { in: toDelete } },
    });
  }

  // UPDATE + CREATE em série pra preservar ordem.
  for (const att of attachments) {
    const data = {
      kind: att.kind,
      title: att.title,
      url: att.url ?? null,
      fileKey: att.fileKey ?? null,
      fileName: att.fileName ?? null,
      fileSize: att.fileSize ?? null,
      mimeType: att.mimeType ?? null,
      description: att.description ?? null,
      order: att.order,
    };
    if (att.id && existingIds.has(att.id)) {
      await prisma.nasaRouteLessonAttachment.update({
        where: { id: att.id },
        data,
      });
    } else {
      await prisma.nasaRouteLessonAttachment.create({
        data: { ...data, lessonId },
      });
    }
  }
}
