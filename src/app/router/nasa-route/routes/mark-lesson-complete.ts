import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { pusherServer } from "@/lib/pusher";
import { awardPoints } from "@/app/router/space-point/utils";
import { awardCourseRewards, issueCertificate } from "../utils";
import { logActivity } from "@/lib/activity-logger";

/**
 * Marca aula como concluída (idempotente).
 * - Concede SP via rule "complete_lesson" (cooldown não aplicável: cada aula é única)
 * - Se for a última aula → seta `completedAt` no progress + enrollment + chama awardCourseRewards
 */
export const markLessonComplete = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      courseId: z.string().min(1),
      lessonId: z.string().min(1),
    }),
  )
  .handler(async ({ input, context }) => {
    const userId = context.user.id;

    // Valida matrícula ativa
    const enrollment = await prisma.nasaRouteEnrollment.findUnique({
      where: { userId_courseId: { userId, courseId: input.courseId } },
      select: { id: true, status: true, planId: true, buyerOrgId: true, completedAt: true },
    });
    if (!enrollment || enrollment.status !== "active") {
      throw new ORPCError("FORBIDDEN", {
        message: "Você ainda não está matriculado neste curso",
      });
    }

    // Curso + aulas
    const course = await prisma.nasaRouteCourse.findUnique({
      where: { id: input.courseId },
      select: {
        id: true,
        title: true,
        slug: true,
        lessons: { select: { id: true, awardSp: true } },
      },
    });
    if (!course) throw new ORPCError("NOT_FOUND", { message: "Curso não encontrado" });

    const lesson = course.lessons.find((l) => l.id === input.lessonId);
    if (!lesson) {
      throw new ORPCError("NOT_FOUND", { message: "Aula não pertence a este curso" });
    }

    // Resolve aulas inclusas no plano do aluno (fallback p/ default plan).
    const plan = enrollment.planId
      ? await prisma.nasaRoutePlan.findUnique({
          where: { id: enrollment.planId },
          select: { id: true, lessons: { select: { lessonId: true } } },
        })
      : await prisma.nasaRoutePlan.findFirst({
          where: { courseId: course.id, isDefault: true },
          select: { id: true, lessons: { select: { lessonId: true } } },
        });

    const planLessonIds = new Set(plan?.lessons.map((l) => l.lessonId) ?? []);

    if (!planLessonIds.has(input.lessonId)) {
      throw new ORPCError("FORBIDDEN", {
        message: "Esta aula não está incluída no seu plano.",
      });
    }

    // Atualiza/cria progress
    const progress = await prisma.nasaRouteProgress.upsert({
      where: { userId_courseId: { userId, courseId: course.id } },
      create: {
        userId,
        courseId: course.id,
        completedLessonIds: [input.lessonId],
        lastLessonId: input.lessonId,
      },
      update: { lastLessonId: input.lessonId },
    });

    let updatedIds = progress.completedLessonIds;
    let lessonWasNew = false;
    if (!updatedIds.includes(input.lessonId)) {
      updatedIds = [...updatedIds, input.lessonId];
      lessonWasNew = true;
      await prisma.nasaRouteProgress.update({
        where: { id: progress.id },
        data: { completedLessonIds: updatedIds },
      });
    }

    // SP por aula concluída (apenas na primeira vez)
    let lessonSpAwarded = 0;
    if (lessonWasNew && enrollment.buyerOrgId) {
      try {
        const r = await awardPoints(
          userId,
          enrollment.buyerOrgId,
          "complete_lesson",
          `Aula concluída: ${course.title}`,
          {
            source: "nasa-route",
            courseId: course.id,
            lessonId: input.lessonId,
            customAwardSp: lesson.awardSp,
          },
        );
        lessonSpAwarded = r.points;
      } catch (err) {
        console.error("[nasa-route/mark-lesson] awardPoints error:", err);
      }
    }

    // Pusher: aula concluída
    if (lessonWasNew) {
      try {
        await pusherServer.trigger(
          `private-user-${userId}`,
          "nasaroute:lesson-completed",
          {
            courseId: course.id,
            lessonId: input.lessonId,
            spAwarded: lessonSpAwarded,
          },
        );
      } catch (err) {
        console.error("[nasa-route/mark-lesson] pusher error:", err);
      }
    }

    // Curso totalmente concluído? — conta apenas aulas inclusas no plano.
    const lessonsInPlan = course.lessons.filter((l) => planLessonIds.has(l.id));
    const completedInPlan = updatedIds.filter((id) => planLessonIds.has(id));
    const totalLessons = lessonsInPlan.length;
    const isFullyComplete = totalLessons > 0 && completedInPlan.length >= totalLessons;
    let courseRewards: { spAwarded: number } | null = null;

    let certificate: { id: string; code: string } | null = null;
    if (isFullyComplete && !progress.completedAt) {
      const now = new Date();
      await prisma.$transaction([
        prisma.nasaRouteProgress.update({
          where: { id: progress.id },
          data: { completedAt: now },
        }),
        prisma.nasaRouteEnrollment.update({
          where: { id: enrollment.id },
          data: { completedAt: now },
        }),
      ]);
      courseRewards = await awardCourseRewards({
        userId,
        buyerOrgId: enrollment.buyerOrgId,
        courseId: course.id,
      });
      try {
        certificate = await issueCertificate({ enrollmentId: enrollment.id });
      } catch (err) {
        console.error("[nasa-route/mark-lesson] issueCertificate error:", err);
      }
    }

    if (lessonWasNew && enrollment.buyerOrgId) {
      await logActivity({
        organizationId: enrollment.buyerOrgId,
        userId,
        userName: context.user.name,
        userEmail: context.user.email,
        userImage: (context.user as any).image,
        appSlug: "nasa-route",
        subAppSlug: "nasa-route-courses",
        featureKey: isFullyComplete ? "route.course.completed" : "route.lesson.completed",
        action: isFullyComplete ? "route.course.completed" : "route.lesson.completed",
        actionLabel: isFullyComplete
          ? `Concluiu o curso "${course.title}"`
          : `Concluiu uma aula em "${course.title}"`,
        resource: course.title,
        resourceId: course.id,
        metadata: { lessonId: input.lessonId, spAwarded: lessonSpAwarded, isFullyComplete },
      });
    }

    return {
      completedLessonIds: updatedIds,
      isFullyComplete,
      lessonSpAwarded,
      courseRewards,
      certificate,
    };
  });
