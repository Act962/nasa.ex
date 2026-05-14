import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";

/** Lista cursos criados pela organização ativa do criador. */
export const creatorListCourses = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .handler(async ({ context }) => {
    const orgId = context.org.id;

    const courses = await prisma.nasaRouteCourse.findMany({
      where: { creatorOrgId: orgId },
      orderBy: [{ createdAt: "desc" }],
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
        isPublished: true,
        publishedAt: true,
        studentsCount: true,
        rewardSpOnComplete: true,
        eventStartsAt: true,
        eventEndsAt: true,
        eventTimezone: true,
        category: { select: { id: true, slug: true, name: true } },
        creatorUser: { select: { id: true, name: true, image: true } },
        _count: { select: { lessons: true, enrollments: true } },
      },
    });

    return { courses };
  });
