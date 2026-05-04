import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { requireCourseManager } from "../utils";
import { logActivity } from "@/lib/activity-logger";

/** Publica/despublica um curso. Exige pelo menos 1 aula para publicar. */
export const creatorPublishCourse = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      courseId: z.string().min(1),
      isPublished: z.boolean(),
    }),
  )
  .handler(async ({ input, context }) => {
    await requireCourseManager(context.user.id, input.courseId);

    if (input.isPublished) {
      const lessonCount = await prisma.nasaRouteLesson.count({
        where: { courseId: input.courseId },
      });
      if (lessonCount === 0) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Adicione pelo menos uma aula antes de publicar",
        });
      }
    }

    const updated = await prisma.nasaRouteCourse.update({
      where: { id: input.courseId },
      data: {
        isPublished: input.isPublished,
        publishedAt: input.isPublished ? new Date() : null,
      },
      select: { id: true, isPublished: true, publishedAt: true, title: true, creatorOrgId: true },
    });

    await logActivity({
      organizationId: updated.creatorOrgId,
      userId: context.user.id,
      userName: context.user.name,
      userEmail: context.user.email,
      userImage: (context.user as any).image,
      appSlug: "nasa-route",
      subAppSlug: "nasa-route-courses",
      featureKey: input.isPublished ? "route.course.published" : "route.course.unpublished",
      action: input.isPublished ? "route.course.published" : "route.course.unpublished",
      actionLabel: input.isPublished
        ? `Publicou o curso "${updated.title}"`
        : `Despublicou o curso "${updated.title}"`,
      resource: updated.title,
      resourceId: updated.id,
    });

    return updated;
  });
