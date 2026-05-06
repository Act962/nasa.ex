import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { parseVideoUrl } from "../utils";

/**
 * Player do aluno: retorna curso completo com vídeos das aulas + filtra
 * pelo plano comprado (lessons + attachments).
 * Requer matrícula ativa (`NasaRouteEnrollment` com `status="active"`).
 */
export const getCourseAsStudent = base
  .use(requiredAuthMiddleware)
  .input(z.object({ courseId: z.string().min(1) }))
  .handler(async ({ input, context }) => {
    const userId = context.user.id;

    const enrollment = await prisma.nasaRouteEnrollment.findUnique({
      where: { userId_courseId: { userId, courseId: input.courseId } },
      select: {
        id: true,
        status: true,
        source: true,
        planId: true,
        enrolledAt: true,
        completedAt: true,
      },
    });
    if (!enrollment || enrollment.status !== "active") {
      throw new ORPCError("FORBIDDEN", {
        message: "Você ainda não está matriculado neste curso",
      });
    }

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
        },
      },
    });
    if (!course) throw new ORPCError("NOT_FOUND", { message: "Curso não encontrado" });

    // Resolve plano da matrícula. Free-access ou enrollments antigos sem plan
    // caem no plano default — acesso completo retroativo.
    const plan = enrollment.planId
      ? await prisma.nasaRoutePlan.findUnique({
          where: { id: enrollment.planId },
          include: {
            lessons: { select: { lessonId: true } },
            attachments: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] },
          },
        })
      : await prisma.nasaRoutePlan.findFirst({
          where: { courseId: course.id, isDefault: true },
          include: {
            lessons: { select: { lessonId: true } },
            attachments: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] },
          },
        });

    const allowedLessonIds = new Set(plan?.lessons.map((l) => l.lessonId) ?? []);

    const progress = await prisma.nasaRouteProgress.findUnique({
      where: { userId_courseId: { userId, courseId: course.id } },
      select: { completedLessonIds: true, lastLessonId: true, startedAt: true, completedAt: true },
    });

    return {
      enrollment,
      plan: plan
        ? {
            id: plan.id,
            name: plan.name,
            description: plan.description,
            priceStars: plan.priceStars,
            isDefault: plan.isDefault,
            attachments: plan.attachments,
          }
        : null,
      course: {
        id: course.id,
        slug: course.slug,
        title: course.title,
        subtitle: course.subtitle,
        description: course.description,
        coverUrl: course.coverUrl,
        level: course.level,
        durationMin: course.durationMin,
        format: course.format,
        priceStars: course.priceStars,
        rewardSpOnComplete: course.rewardSpOnComplete,
        // Metadados públicos por formato — viewers usam pra renderizar.
        // URLs sensíveis (ebookFileKey, eventStreamUrl, communityInviteUrl)
        // continuam em procedures dedicadas pra controlar TTL e auditoria.
        ebookFileName: course.ebookFileName,
        ebookFileSize: course.ebookFileSize,
        ebookMimeType: course.ebookMimeType,
        ebookPageCount: course.ebookPageCount,
        eventStartsAt: course.eventStartsAt,
        eventEndsAt: course.eventEndsAt,
        eventTimezone: course.eventTimezone,
        eventLocationNote: course.eventLocationNote,
        communityType: course.communityType,
        subscriptionPeriod: course.subscriptionPeriod,
        category: course.category,
        creatorOrg: course.creatorOrg,
        creator: course.creatorUser,
        modules: course.modules,
        lessons: course.lessons.map((l) => {
          const video = parseVideoUrl(l.videoUrl);
          const includedInPlan = allowedLessonIds.has(l.id);
          return {
            id: l.id,
            order: l.order,
            moduleId: l.moduleId,
            title: l.title,
            summary: l.summary,
            contentMd: includedInPlan ? l.contentMd : null,
            durationMin: l.durationMin,
            isFreePreview: l.isFreePreview,
            awardSp: l.awardSp,
            video: includedInPlan ? video : { provider: null, videoId: null, embedUrl: null },
            includedInPlan,
          };
        }),
      },
      progress: progress ?? {
        completedLessonIds: [],
        lastLessonId: null,
        startedAt: null,
        completedAt: null,
      },
    };
  });
