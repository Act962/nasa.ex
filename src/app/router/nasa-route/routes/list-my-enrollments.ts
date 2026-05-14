import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";

/** Cursos em que o usuário está matriculado, com progresso. */
export const listMyEnrollments = base
  .use(requiredAuthMiddleware)
  .handler(async ({ context }) => {
    const userId = context.user.id;

    const enrollments = await prisma.nasaRouteEnrollment.findMany({
      where: { userId, status: "active" },
      orderBy: { enrolledAt: "desc" },
      include: {
        course: {
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
            eventStartsAt: true,
            eventEndsAt: true,
            eventTimezone: true,
            creatorOrg: { select: { id: true, name: true, slug: true, logo: true } },
            _count: { select: { lessons: true } },
          },
        },
      },
    });

    const courseIds = enrollments.map((e) => e.courseId);
    const progresses = courseIds.length
      ? await prisma.nasaRouteProgress.findMany({
          where: { userId, courseId: { in: courseIds } },
          select: {
            courseId: true,
            completedLessonIds: true,
            lastLessonId: true,
            startedAt: true,
            completedAt: true,
          },
        })
      : [];
    const progressByCourse = new Map(progresses.map((p) => [p.courseId, p]));

    return {
      enrollments: enrollments.map((e) => {
        const p = progressByCourse.get(e.courseId);
        const total = e.course._count.lessons;
        const done = p?.completedLessonIds.length ?? 0;
        return {
          id: e.id,
          enrolledAt: e.enrolledAt,
          completedAt: e.completedAt,
          source: e.source,
          paidStars: e.paidStars,
          course: {
            id: e.course.id,
            slug: e.course.slug,
            title: e.course.title,
            subtitle: e.course.subtitle,
            coverUrl: e.course.coverUrl,
            level: e.course.level,
            durationMin: e.course.durationMin,
            format: e.course.format,
            priceStars: e.course.priceStars,
            eventStartsAt: e.course.eventStartsAt,
            eventEndsAt: e.course.eventEndsAt,
            eventTimezone: e.course.eventTimezone,
            creatorOrg: e.course.creatorOrg,
            lessonCount: total,
          },
          progress: {
            completed: done,
            total,
            pct: total > 0 ? Math.round((done / total) * 100) : 0,
            lastLessonId: p?.lastLessonId ?? null,
          },
        };
      }),
    };
  });
