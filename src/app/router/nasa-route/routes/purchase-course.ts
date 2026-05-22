import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { pusherServer } from "@/lib/pusher";
import { awardPoints } from "@/app/router/space-point/utils";
import { canEnrollFree } from "../utils";
import { createSubscriptionInTx } from "../helpers/subscription-helpers";
import { createPurchaseSideEffects } from "../helpers/purchase-crm-side-effects";
import type { SubscriptionPeriod } from "@/features/nasa-route/lib/formats";
import { logActivity } from "@/features/admin/lib/activity-logger";
import { getStripe } from "@/lib/stripe";
import { getStarPriceBrl } from "@/features/nasa-route/lib/pricing";

/**
 * Matrícula no curso pelo aluno autenticado.
 *
 * Modelo unificado:
 *  - Cursos `isFree=true` ou cobertos por NasaRouteFreeAccess → matrícula
 *    imediata (sem checkout, sem cobrança).
 *  - Cursos pagos → cria `PendingCoursePurchase (flow="authenticated")` +
 *    Stripe Checkout Session em BRL. Retorna `{ checkoutUrl }` para o
 *    cliente redirecionar. O enrollment é criado pelo webhook quando o
 *    pagamento confirma (ver finalizeStripePurchaseInTx + /api/stripe/webhook).
 *
 * Stars NÃO compra mais curso. O saldo Stars só é creditado ao criador
 * como payout interno (até Stripe Connect ser habilitado).
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

    // 1. Carrega curso
    const course = await prisma.nasaRouteCourse.findUnique({
      where: { id: input.courseId },
      select: {
        id: true,
        slug: true,
        title: true,
        priceStars: true,
        priceBrlCents: true,
        isFree: true,
        isPublished: true,
        coverUrl: true,
        creatorOrgId: true,
        creatorUserId: true,
        format: true,
        eventStartsAt: true,
        eventEndsAt: true,
        subscriptionPeriod: true,
        purchaseTrackingId: true,
        purchaseStatusId: true,
        creatorOrg: { select: { slug: true, name: true } },
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

    // 1b. Resolver plano
    const plan = input.planId
      ? await prisma.nasaRoutePlan.findUnique({
          where: { id: input.planId },
          select: {
            id: true,
            courseId: true,
            name: true,
            priceStars: true,
            priceBrlCents: true,
            isDefault: true,
          },
        })
      : (await prisma.nasaRoutePlan.findFirst({
          where: { courseId: course.id, isDefault: true },
          select: {
            id: true,
            courseId: true,
            name: true,
            priceStars: true,
            priceBrlCents: true,
            isDefault: true,
          },
        })) ??
        (await prisma.nasaRoutePlan.findFirst({
          where: { courseId: course.id },
          orderBy: [{ order: "asc" }, { createdAt: "asc" }],
          select: {
            id: true,
            courseId: true,
            name: true,
            priceStars: true,
            priceBrlCents: true,
            isDefault: true,
          },
        }));

    if (!plan || plan.courseId !== course.id) {
      throw new ORPCError("NOT_FOUND", {
        message: "Plano não encontrado para este curso",
      });
    }

    // 2. Já matriculado?
    const existing = await prisma.nasaRouteEnrollment.findUnique({
      where: { userId_courseId: { userId, courseId: course.id } },
      select: { id: true, status: true },
    });
    if (existing && existing.status === "active") {
      return {
        kind: "already_enrolled" as const,
        enrollmentId: existing.id,
      };
    }

    // 3. Curso gratuito? (flag explícita OU free access concedido OU legado priceBrlCents=0 sem flag)
    const freeAccess = await canEnrollFree(userId, course.id, course.creatorOrgId);
    const isFreeCourse = course.isFree || (course.priceBrlCents <= 0 && plan.priceBrlCents <= 0);

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
            paidBrlCents: 0,
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

        if (course.format === "subscription") {
          const period = (course.subscriptionPeriod ?? "monthly") as SubscriptionPeriod;
          await createSubscriptionInTx({ tx, enrollmentId: e.id, period });
        }

        return e;
      });

      await safeAwardEnroll({
        userId,
        buyerOrgId,
        courseTitle: course.title,
        courseId: course.id,
      });
      await safePushPurchaseEvents({
        userId,
        creatorUserId: course.creatorUserId,
        courseId: course.id,
        courseTitle: course.title,
        paidStars: 0,
        payoutStars: 0,
      });

      await createPurchaseSideEffects({
        buyer: {
          userId,
          name: context.user.name,
          email: context.user.email,
          phone: (context.user as any).phone ?? null,
        },
        creatorOrgId: course.creatorOrgId,
        createdByUserId: userId,
        course: {
          id: course.id,
          title: course.title,
          priceStars: 0,
          purchaseTrackingId: course.purchaseTrackingId,
          purchaseStatusId: course.purchaseStatusId,
        },
        planName: plan.name,
        enrollmentId: enrollment.id,
      });

      return {
        kind: "enrolled" as const,
        enrollmentId: enrollment.id,
        source,
      };
    }

    // 4. Curso pago → cria checkout Stripe.
    // Plano precisa ter preço BRL configurado.
    const amountBrlCents = plan.priceBrlCents;
    if (amountBrlCents < 50) {
      // Mínimo Stripe BRL = R$ 0,50. Bloqueia configuração inválida do criador.
      throw new ORPCError("BAD_REQUEST", {
        message:
          "Plano sem preço válido. Peça ao criador para configurar o valor em reais.",
        data: { code: "PRICE_NOT_CONFIGURED" },
      });
    }

    // Snapshot da cotação para payout interno em Stars (até Connect).
    const starPriceBrl = await getStarPriceBrl();

    const pending = await prisma.pendingCoursePurchase.create({
      data: {
        email: context.user.email,
        userId,
        flow: "authenticated",
        courseId: course.id,
        planId: plan.id,
        priceStars: plan.priceStars,
        amountBrlCents,
        starPriceBrlSnapshot: starPriceBrl,
        status: "PENDING",
      },
      select: { id: true },
    });

    const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const successUrl = `${origin}/nasa-route/checkout/sucesso?pendingId=${pending.id}&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${origin}/c/${course.creatorOrg.slug}/${course.slug}`;

    try {
      const stripe = getStripe();
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: context.user.email,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "brl",
              unit_amount: amountBrlCents,
              product_data: {
                name: `${course.title} — ${plan.name}`,
                description: course.creatorOrg.name,
                images: course.coverUrl ? [course.coverUrl] : undefined,
              },
            },
          },
        ],
        success_url: successUrl,
        cancel_url: cancelUrl,
        payment_method_types: ["card"],
        locale: "pt-BR",
        metadata: {
          kind: "course_purchase",
          flow: "authenticated",
          pendingId: pending.id,
          courseId: course.id,
          planId: plan.id,
          userId,
        },
      });

      if (!session.url) {
        throw new Error("Stripe não retornou URL de checkout.");
      }

      await prisma.pendingCoursePurchase.update({
        where: { id: pending.id },
        data: {
          stripeSessionId: session.id,
          stripePaymentIntentId:
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : null,
        },
      });

      await logActivity({
        organizationId: buyerOrgId,
        userId,
        userName: context.user.name,
        userEmail: context.user.email,
        userImage: (context.user as any).image,
        appSlug: "nasa-route",
        subAppSlug: "nasa-route-courses",
        featureKey: "route.course.checkout_started",
        action: "route.course.checkout_started",
        actionLabel: `Iniciou checkout do curso "${course.title}"`,
        resource: course.title,
        resourceId: course.id,
        metadata: { planName: plan.name, amountBrlCents },
      });

      return {
        kind: "checkout" as const,
        checkoutUrl: session.url,
        pendingId: pending.id,
        amountBrlCents,
      };
    } catch (err) {
      await prisma.pendingCoursePurchase
        .update({
          where: { id: pending.id },
          data: { status: "CANCELLED" },
        })
        .catch(() => {});

      const msg = err instanceof Error ? err.message : "Erro ao criar checkout.";
      if (msg.includes("STRIPE_SECRET_KEY")) {
        throw new ORPCError("INTERNAL_SERVER_ERROR", {
          message:
            "Gateway de pagamento não configurado. Contate o suporte.",
          data: { code: "STRIPE_NOT_CONFIGURED" },
        });
      }
      throw new ORPCError("INTERNAL_SERVER_ERROR", { message: msg });
    }
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
