import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { ORPCError } from "@orpc/server";

/**
 * Lista cursos publicados de uma organização criadora pela slug pública.
 * Sem auth — alimenta `/c/[companySlug]`.
 */
export const publicListByCompany = base
  .input(z.object({ companySlug: z.string().min(1) }))
  .handler(async ({ input }) => {
    const org = await prisma.organization.findUnique({
      where: { slug: input.companySlug },
      select: {
        id: true,
        name: true,
        slug: true,
        logo: true,
      },
    });
    if (!org) throw new ORPCError("NOT_FOUND", { message: "Organização não encontrada" });

    const courses = await prisma.nasaRouteCourse.findMany({
      where: { creatorOrgId: org.id, isPublished: true },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        slug: true,
        title: true,
        subtitle: true,
        coverUrl: true,
        level: true,
        durationMin: true,
        format: true,
        priceStars: true,
        studentsCount: true,
        // Datas (format = "event") — usadas pelo card pra mostrar badge na capa.
        eventStartsAt: true,
        eventEndsAt: true,
        eventTimezone: true,
        category: { select: { id: true, slug: true, name: true, iconKey: true } },
        _count: { select: { lessons: true } },
      },
    });

    return {
      org: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        logo: org.logo,
      },
      courses: courses.map((c) => ({
        id: c.id,
        slug: c.slug,
        title: c.title,
        subtitle: c.subtitle,
        coverUrl: c.coverUrl,
        level: c.level,
        durationMin: c.durationMin,
        format: c.format,
        priceStars: c.priceStars,
        studentsCount: c.studentsCount,
        category: c.category,
        lessonCount: c._count.lessons,
      })),
    };
  });
