import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { requireCourseManager } from "../utils";

export const creatorListPlans = base
  .use(requiredAuthMiddleware)
  .input(z.object({ courseId: z.string().min(1) }))
  .handler(async ({ input, context }) => {
    await requireCourseManager(context.user.id, input.courseId);

    const plans = await prisma.nasaRoutePlan.findMany({
      where: { courseId: input.courseId },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      include: {
        lessons: { select: { lessonId: true } },
        attachments: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] },
        _count: { select: { enrollments: true } },
      },
    });

    return {
      plans: plans.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        priceStars: p.priceStars,
        priceBrlCents: p.priceBrlCents,
        order: p.order,
        isDefault: p.isDefault,
        lessonIds: p.lessons.map((l) => l.lessonId),
        attachments: p.attachments,
        enrollmentCount: p._count.enrollments,
      })),
    };
  });
