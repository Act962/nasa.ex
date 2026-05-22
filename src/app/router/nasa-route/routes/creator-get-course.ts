import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { requireCourseManager, parseVideoUrl } from "../utils";

/**
 * Retorna o curso completo (com módulos + aulas) para edição pelo criador.
 * Diferente de `getCourseAsStudent` (que exige matrícula): exige ser owner ou
 * moderador da org criadora.
 */
export const creatorGetCourse = base
  .use(requiredAuthMiddleware)
  .input(z.object({ courseId: z.string().min(1) }))
  .handler(async ({ input, context }) => {
    await requireCourseManager(context.user.id, input.courseId);

    const course = await prisma.nasaRouteCourse.findUnique({
      where: { id: input.courseId },
      include: {
        category: { select: { id: true, slug: true, name: true } },
        creatorOrg: { select: { id: true, name: true, slug: true, logo: true } },
        creatorUser: { select: { id: true, name: true, image: true } },
        modules: {
          orderBy: { order: "asc" },
          select: { id: true, order: true, title: true, summary: true },
        },
        lessons: {
          orderBy: { order: "asc" },
          include: {
            attachments: {
              orderBy: [{ order: "asc" }, { createdAt: "asc" }],
            },
          },
        },
        plans: {
          orderBy: [{ order: "asc" }, { createdAt: "asc" }],
          include: {
            lessons: { select: { lessonId: true } },
            attachments: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] },
            _count: { select: { enrollments: true } },
          },
        },
        _count: { select: { enrollments: true } },
      },
    });
    if (!course) throw new ORPCError("NOT_FOUND", { message: "Curso não encontrado" });

    return {
      course: {
        id: course.id,
        slug: course.slug,
        title: course.title,
        subtitle: course.subtitle,
        description: course.description,
        coverUrl: course.coverUrl,
        trailerUrl: course.trailerUrl,
        level: course.level,
        durationMin: course.durationMin,
        format: course.format,
        priceStars: course.priceStars,
        isPublished: course.isPublished,
        publishedAt: course.publishedAt,
        studentsCount: course.studentsCount,
        rewardSpOnComplete: course.rewardSpOnComplete,
        // Datas unificadas (todos formatos)
        startsAt: course.startsAt,
        endsAt: course.endsAt,
        // Legado evento (preservado pra compat)
        eventStartsAt: course.eventStartsAt,
        eventEndsAt: course.eventEndsAt,
        isArchived: course.isArchived,
        // Funil pós-compra
        purchaseTrackingId: course.purchaseTrackingId,
        purchaseStatusId: course.purchaseStatusId,
        // Integrações marketing
        redirectUrl: course.redirectUrl,
        pixelId: course.pixelId,
        gtmId: course.gtmId,
        categoryId: course.categoryId,
        category: course.category,
        creatorOrg: course.creatorOrg,
        creator: course.creatorUser,
        modules: course.modules,
        lessons: course.lessons.map((l) => ({
          id: l.id,
          order: l.order,
          moduleId: l.moduleId,
          title: l.title,
          summary: l.summary,
          contentMd: l.contentMd,
          videoUrl: l.videoUrl,
          videoProvider: l.videoProvider,
          videoId: l.videoId,
          videoFileKey: l.videoFileKey,
          videoFileSize: l.videoFileSize ? Number(l.videoFileSize) : null,
          thumbnailKey: l.thumbnailKey,
          durationMin: l.durationMin,
          isFreePreview: l.isFreePreview,
          awardSp: l.awardSp,
          video: parseVideoUrl(l.videoUrl),
          attachments: ((l as any).attachments ?? []).map((a: any) => ({
            id: a.id,
            kind: a.kind,
            title: a.title,
            url: a.url,
            fileKey: a.fileKey,
            fileName: a.fileName,
            fileSize: a.fileSize,
            mimeType: a.mimeType,
            description: a.description,
            order: a.order,
          })),
        })),
        plans: course.plans.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          priceStars: p.priceStars,
          order: p.order,
          isDefault: p.isDefault,
          lessonIds: p.lessons.map((l) => l.lessonId),
          attachments: p.attachments,
          enrollmentCount: p._count.enrollments,
        })),
        enrollmentCount: course._count.enrollments,
      },
    };
  });
