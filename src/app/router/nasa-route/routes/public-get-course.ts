import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { parseVideoUrl } from "../utils";

/**
 * Página pública do curso: hero + currículo (lessons com `locked` flag para o
 * que NÃO é free preview). Sem auth — usado em `/c/[companySlug]/[courseSlug]`.
 */
export const publicGetCourse = base
  .input(
    z.object({
      companySlug: z.string().min(1),
      courseSlug: z.string().min(1),
    }),
  )
  .handler(async ({ input }) => {
    const org = await prisma.organization.findUnique({
      where: { slug: input.companySlug },
      select: { id: true, name: true, slug: true, logo: true },
    });
    if (!org) throw new ORPCError("NOT_FOUND", { message: "Organização não encontrada" });

    const course = await prisma.nasaRouteCourse.findUnique({
      where: {
        creatorOrgId_slug: { creatorOrgId: org.id, slug: input.courseSlug },
      },
      include: {
        category: { select: { id: true, slug: true, name: true } },
        modules: {
          orderBy: { order: "asc" },
          select: { id: true, order: true, title: true, summary: true },
        },
        lessons: {
          orderBy: { order: "asc" },
          select: {
            id: true,
            order: true,
            moduleId: true,
            title: true,
            summary: true,
            durationMin: true,
            isFreePreview: true,
          },
        },
        plans: {
          orderBy: [{ order: "asc" }, { createdAt: "asc" }],
          include: {
            lessons: { select: { lessonId: true } },
            attachments: {
              orderBy: [{ order: "asc" }, { createdAt: "asc" }],
              select: { id: true, kind: true, title: true, description: true },
            },
          },
        },
        creatorUser: {
          select: { id: true, name: true, image: true },
        },
      },
    });
    if (!course || !course.isPublished) {
      throw new ORPCError("NOT_FOUND", { message: "Curso não encontrado" });
    }

    const trailer = parseVideoUrl(course.trailerUrl);

    const minPriceStars =
      course.plans.length > 0
        ? Math.min(...course.plans.map((p) => p.priceStars))
        : course.priceStars;

    return {
      org,
      course: {
        id: course.id,
        slug: course.slug,
        title: course.title,
        subtitle: course.subtitle,
        description: course.description,
        coverUrl: course.coverUrl,
        trailer,
        level: course.level,
        durationMin: course.durationMin,
        format: course.format,
        priceStars: course.priceStars,
        minPriceStars,
        studentsCount: course.studentsCount,
        rewardSpOnComplete: course.rewardSpOnComplete,
        // Campos por formato — só metadados públicos.
        // URLs sensíveis (ebookFileKey, communityInviteUrl, eventStreamUrl)
        // só vêm via procedures autenticadas após matrícula.
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
        creator: course.creatorUser,
        modules: course.modules,
        lessons: course.lessons.map((l) => ({
          id: l.id,
          order: l.order,
          moduleId: l.moduleId,
          title: l.title,
          summary: l.summary,
          durationMin: l.durationMin,
          isFreePreview: l.isFreePreview,
          locked: !l.isFreePreview,
        })),
        plans: course.plans.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          priceStars: p.priceStars,
          isDefault: p.isDefault,
          lessonCount: p.lessons.length,
          attachments: p.attachments,
        })),
      },
    };
  });
