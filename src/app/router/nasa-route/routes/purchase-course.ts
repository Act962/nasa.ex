import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { StarTransactionType } from "@/generated/prisma/enums";
import { pusherServer } from "@/lib/pusher";
import { awardPoints } from "@/app/router/space-point/utils";
import { canEnrollFree } from "../utils";
import { executeCoursePurchaseInTx } from "../helpers/purchase-helpers";
import { logActivity } from "@/features/admin/lib/activity-logger";

/**
 * Compra de curso pelo aluno (paga com STARs da org dele).
 *
 * Fluxo:
 *  1. Valida curso publicado + não estar já matriculado
 *  2. Free Access? → enrollment grátis, pula 3-4
 *  3. Saldo da org buyer >= preço? → senão lança INSUFFICIENT_STARS
 *  4. $transaction: debit aluno + credit criador (90%) + cria enrollment + cria progress + studentsCount++
 *  5. awardPoints("enroll_course") + Pusher
 *
 * Formatos especiais:
 *  - event: bloqueia compra se evento já encerrou.
 *  - subscription: cria registro `NasaRouteSubscription` pra cobrar mensalmente via cron Inngest.
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
        format: true,
        eventStartsAt: true,
        eventEndsAt: true,
        subscriptionPeriod: true,
      },
    });
    if (!course || !course.isPublished) {
      throw new ORPCError("NOT_FOUND", { message: "Curso não encontrado" });
    }

    // 1a. Validações específicas por formato
    if (course.format === "event") {
      const now = new Date();
      const ended =
        course.eventEndsAt && course.eventEndsAt < now
          ? true
          : course.eventStartsAt && course.eventStartsAt < now && !course.eventEndsAt
            ? true
            : false;
      if (ended) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Evento já encerrado — não é mais possível garantir vaga.",
          data: { code: "EVENT_ENDED" },
        });
      }
    }

    // 1b. Resolver plano: se planId vier, valida; senão usa o default.
    const plan = input.planId
      ? await prisma.nasaRoutePlan.findUnique({
          where: { id: input.planId },
          select: { id: true, courseId: true, name: true, priceStars: true, isDefault: true },
        })
      : (await prisma.nasaRoutePlan.findFirst({
          where: { courseId: course.id, isDefault: true },
          select: { id: true, courseId: true, name: true, priceStars: true, isDefault: true },
        })) ??
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

        // Assinatura grátis (preço 0) ou via free-access: cria registro
        // de subscription mesmo assim pra rastreio. Cron skipará cobrança
        // quando priceStars=0.
        if (course.format === "subscription") {
          const period = (course.subscriptionPeriod ?? "monthly") as SubscriptionPeriod;
          await createSubscriptionInTx({ tx, enrollmentId: e.id, period });
        }

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
    const payoutStars = Math.floor(priceStars * (1 - PLATFORM_FEE_PCT));
    const platformFee = priceStars - payoutStars;

    const result = await prisma.$transaction(async (tx) => {
      // Debit aluno
      const buyer = await tx.organization.findUniqueOrThrow({
        where: { id: buyerOrgId },
        select: { starsBalance: true },
      });
      if (buyer.starsBalance < priceStars) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Saldo insuficiente",
          data: { code: "INSUFFICIENT_STARS" },
        });
      }
      const buyerNewBalance = buyer.starsBalance - priceStars;
      await tx.organization.update({
        where: { id: buyerOrgId },
        data: { starsBalance: buyerNewBalance },
      });
      const debit = await tx.starTransaction.create({
        data: {
          organizationId: buyerOrgId,
          type: StarTransactionType.COURSE_PURCHASE,
          amount: -priceStars,
          balanceAfter: buyerNewBalance,
          description: `Compra: ${course.title} — Plano ${plan.name}`,
          appSlug: "nasa-route",
        },
      });

      // Credit criador (90% do valor)
      const creator = await tx.organization.findUniqueOrThrow({
        where: { id: course.creatorOrgId },
        select: { starsBalance: true },
      });
      const creatorNewBalance = creator.starsBalance + payoutStars;
      await tx.organization.update({
        where: { id: course.creatorOrgId },
        data: { starsBalance: creatorNewBalance },
      });
      await tx.starTransaction.create({
        data: {
          organizationId: course.creatorOrgId,
          type: StarTransactionType.COURSE_PAYOUT,
          amount: payoutStars,
          balanceAfter: creatorNewBalance,
          description: `Venda: ${course.title} — Plano ${plan.name} (taxa ${platformFee} ★ retida)`,
          appSlug: "nasa-route",
        },
      });

      // Cria/ativa enrollment
      const enrollment = await tx.nasaRouteEnrollment.upsert({
        where: { userId_courseId: { userId, courseId: course.id } },
        create: {
          userId,
          courseId: course.id,
          planId: plan.id,
          buyerOrgId,
          paidStars: priceStars,
          source: "purchase",
          status: "active",
          paymentRef: debit.id,
        },
        update: {
          status: "active",
          paidStars: priceStars,
          planId: plan.id,
          buyerOrgId,
          paymentRef: debit.id,
        },
      });

      // Progress vazio
      await tx.nasaRouteProgress.upsert({
        where: { userId_courseId: { userId, courseId: course.id } },
        create: { userId, courseId: course.id, completedLessonIds: [] },
        update: {},
      });

      // Atualiza contador do curso
      await tx.nasaRouteCourse.update({
        where: { id: course.id },
        data: { studentsCount: { increment: 1 } },
      });

      // Assinatura: cria registro pra cobrar mensalmente via Inngest cron
      if (course.format === "subscription") {
        const period = (course.subscriptionPeriod ?? "monthly") as SubscriptionPeriod;
        await createSubscriptionInTx({
          tx,
          enrollmentId: enrollment.id,
          period,
        });
      }

      return { enrollment, buyerNewBalance, creatorNewBalance };
    });

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
