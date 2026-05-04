import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { pusherServer } from "@/lib/pusher";
import { awardPoints } from "@/app/router/space-point/utils";
<<<<<<< feature/W-nasa-router-fluxo-de-aquisicao-de-cursos-20260503
import { canEnrollFree } from "../utils";
import { executeCoursePurchaseInTx } from "../helpers/purchase-helpers";
=======
import { canEnrollFree, PLATFORM_FEE_PCT } from "../utils";
import { logActivity } from "@/lib/activity-logger";
>>>>>>> main

/**
 * Compra de curso pelo aluno (paga com STARs da org dele).
 *
 * Fluxo:
 *  1. Valida curso publicado + não estar já matriculado
 *  2. Free Access? → enrollment grátis, pula 3-4
 *  3. Saldo da org buyer >= preço? → senão lança INSUFFICIENT_STARS
 *  4. $transaction: debit aluno + credit criador (90%) + cria enrollment + cria progress + studentsCount++
 *  5. awardPoints("enroll_course") + Pusher
 */
export const purchaseCourse = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      courseId: z.string().min(1),
      planId: z.string().min(1).optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const userId = context.user.id;
    const buyerOrgId = context.org.id;

    // 1. Carregar curso
    const course = await prisma.nasaRouteCourse.findUnique({
      where: { id: input.courseId },
      select: {
        id: true,
        slug: true,
        title: true,
        priceStars: true,
        isPublished: true,
        creatorOrgId: true,
        creatorUserId: true,
      },
    });
    if (!course || !course.isPublished) {
      throw new ORPCError("NOT_FOUND", { message: "Curso não encontrado" });
    }

    // 1b. Resolver plano: se planId vier, valida; senão usa o default.
    const plan = input.planId
      ? await prisma.nasaRoutePlan.findUnique({
          where: { id: input.planId },
          select: { id: true, courseId: true, name: true, priceStars: true, isDefault: true },
        })
      : await prisma.nasaRoutePlan.findFirst({
          where: { courseId: course.id, isDefault: true },
          select: { id: true, courseId: true, name: true, priceStars: true, isDefault: true },
        }) ??
        (await prisma.nasaRoutePlan.findFirst({
          where: { courseId: course.id },
          orderBy: [{ order: "asc" }, { createdAt: "asc" }],
          select: { id: true, courseId: true, name: true, priceStars: true, isDefault: true },
        }));

    if (!plan || plan.courseId !== course.id) {
      throw new ORPCError("NOT_FOUND", {
        message: "Plano não encontrado para este curso",
      });
    }
    const priceStars = plan.priceStars;

    // 2. Já matriculado?
    const existing = await prisma.nasaRouteEnrollment.findUnique({
      where: { userId_courseId: { userId, courseId: course.id } },
      select: { id: true, status: true },
    });
    if (existing && existing.status === "active") {
      return { enrollmentId: existing.id, alreadyEnrolled: true, source: "existing" as const };
    }

    // 3. Acesso livre? (criador da org criadora liberou esse user)
    const freeAccess = await canEnrollFree(userId, course.id, course.creatorOrgId);
    const isFreeCourse = priceStars === 0;

    if (freeAccess || isFreeCourse) {
      const source = freeAccess ? "free_access" : "purchase";
      const enrollment = await prisma.$transaction(async (tx) => {
        const e = await tx.nasaRouteEnrollment.upsert({
          where: { userId_courseId: { userId, courseId: course.id } },
          create: {
            userId,
            courseId: course.id,
            planId: plan.id,
            buyerOrgId,
            paidStars: 0,
            source,
            status: "active",
          },
          update: { status: "active", source, planId: plan.id },
        });
        await tx.nasaRouteProgress.upsert({
          where: { userId_courseId: { userId, courseId: course.id } },
          create: { userId, courseId: course.id, completedLessonIds: [] },
          update: {},
        });
        await tx.nasaRouteCourse.update({
          where: { id: course.id },
          data: { studentsCount: { increment: 1 } },
        });
        return e;
      });

      await safeAwardEnroll({ userId, buyerOrgId, courseTitle: course.title, courseId: course.id });
      await safePushPurchaseEvents({
        userId,
        creatorUserId: course.creatorUserId,
        courseId: course.id,
        courseTitle: course.title,
        paidStars: 0,
        payoutStars: 0,
      });

      return {
        enrollmentId: enrollment.id,
        alreadyEnrolled: false,
        source,
        paidStars: 0,
        payoutStars: 0,
      };
    }

    // 4. Validar saldo (apenas gastável — bônus não paga curso)
    const buyerOrg = await prisma.organization.findUniqueOrThrow({
      where: { id: buyerOrgId },
      select: { starsBalance: true, starsBonusBalance: true },
    });
    if (buyerOrg.starsBalance < priceStars) {
      throw new ORPCError("BAD_REQUEST", {
        message: `Saldo de STARs insuficiente. Necessário: ${priceStars} ★`,
        data: {
          code: "INSUFFICIENT_STARS",
          balance: buyerOrg.starsBalance,
          bonusBalance: buyerOrg.starsBonusBalance,
          needed: priceStars,
        },
      });
    }

    // 5. Transação atômica: debit aluno + credit criador + enrollment + progress + studentsCount++
    const result = await prisma.$transaction(async (tx) =>
      executeCoursePurchaseInTx({
        tx,
        userId,
        buyerOrgId,
        courseId: course.id,
        courseTitle: course.title,
        creatorOrgId: course.creatorOrgId,
        planId: plan.id,
        planName: plan.name,
        priceStars,
      }),
    );
    const { payoutStars } = result;

    // 6. SP de matrícula (não-crítico)
    await safeAwardEnroll({ userId, buyerOrgId, courseTitle: course.title, courseId: course.id });

    // 7. Pusher (não-crítico)
    await safePushPurchaseEvents({
      userId,
      creatorUserId: course.creatorUserId,
      courseId: course.id,
      courseTitle: course.title,
      paidStars: priceStars,
      payoutStars,
    });

    await logActivity({
      organizationId: buyerOrgId,
      userId,
      userName: context.user.name,
      userEmail: context.user.email,
      userImage: (context.user as any).image,
      appSlug: "nasa-route",
      subAppSlug: "nasa-route-courses",
      featureKey: "route.course.purchased",
      action: "route.course.purchased",
      actionLabel: `Comprou o curso "${course.title}"`,
      resource: course.title,
      resourceId: course.id,
      metadata: { paidStars: priceStars, planName: plan.name },
    });

    return {
      enrollmentId: result.enrollment.id,
      alreadyEnrolled: false,
      source: "purchase" as const,
      paidStars: priceStars,
      payoutStars,
      buyerNewBalance: result.buyerNewBalance,
    };
  });

async function safeAwardEnroll(opts: {
  userId: string;
  buyerOrgId: string;
  courseId: string;
  courseTitle: string;
}) {
  try {
    await awardPoints(
      opts.userId,
      opts.buyerOrgId,
      "enroll_course",
      `Inscrição em curso: ${opts.courseTitle}`,
      { source: "nasa-route", courseId: opts.courseId },
    );
  } catch (err) {
    console.error("[nasa-route/purchase] awardPoints error:", err);
  }
}

async function safePushPurchaseEvents(opts: {
  userId: string;
  creatorUserId: string;
  courseId: string;
  courseTitle: string;
  paidStars: number;
  payoutStars: number;
}) {
  try {
    await pusherServer.trigger(
      `private-user-${opts.userId}`,
      "nasaroute:course-purchased",
      { courseId: opts.courseId, courseTitle: opts.courseTitle, paidStars: opts.paidStars },
    );
    if (opts.creatorUserId !== opts.userId) {
      await pusherServer.trigger(
        `private-user-${opts.creatorUserId}`,
        "nasaroute:course-sold",
        {
          courseId: opts.courseId,
          courseTitle: opts.courseTitle,
          payoutStars: opts.payoutStars,
        },
      );
    }
  } catch (err) {
    console.error("[nasa-route/purchase] pusher error:", err);
  }
}
