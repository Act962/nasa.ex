/**
 * Handler agnóstico de framework do webhook dedicado do Stripe (NASA Route /
 * cursos + topup legacy de Stars + refund/dispute). Recebe o corpo CRU + a
 * assinatura e devolve `{ status, body }` — sem acoplar a Next nem a Fastify.
 * Consumido pelo route do Next (apps/web) e pela rota Fastify (apps/api).
 *
 * Subscriptions de plano são tratadas pelo webhook do better-auth em
 * `/api/auth/stripe/webhook` — não duplicar handlers aqui.
 *
 * Configurar no Stripe Dashboard:
 *   Secret: STRIPE_COURSE_WEBHOOK_SECRET
 *   Eventos: checkout.session.completed, payment_intent.succeeded,
 *            checkout.session.expired, charge.refunded, charge.dispute.created
 */

import { randomBytes } from "node:crypto";
import { constructWebhookEvent } from "@/lib/stripe";
import prisma from "@/lib/prisma";
import { purchaseTopUp } from "@/features/stars/lib/star-service";
import { inngest } from "@/inngest/client";
import {
  finalizeStripePurchaseInTx,
  revokeStripePurchaseInTx,
} from "@/app/router/nasa-route/helpers/purchase-helpers";
import { createPurchaseSideEffects } from "@/app/router/nasa-route/helpers/purchase-crm-side-effects";
import { triggerPurchaseEmail } from "@/features/nasa-route/lib/purchase-email";
import { getPostHogClient } from "@/lib/posthog-server";

const SIGNUP_TOKEN_TTL_DAYS = 7;

export type WebhookResult = { status: number; body: unknown };

export async function handleStripeCourseWebhook(
  rawBody: string,
  signature: string,
): Promise<WebhookResult> {
  // ── Validate signature ─────────────────────────────────────────────────────
  // Endpoint dedicado a cursos — usa STRIPE_COURSE_WEBHOOK_SECRET. Mantém
  // fallback pra STRIPE_WEBHOOK_SECRET pra compat com ambientes antigos.
  const courseSecret =
    process.env.STRIPE_COURSE_WEBHOOK_SECRET ??
    process.env.STRIPE_WEBHOOK_SECRET;
  let event;
  try {
    event = constructWebhookEvent(rawBody, signature, courseSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Webhook error";
    console.error("[stripe/webhook] signature error:", message);
    return { status: 400, body: { error: message } };
  }

  // ── Handle events ──────────────────────────────────────────────────────────
  try {
    switch (event.type) {
      // ── Checkout concluído ───────────────────────────────────────────────────
      case "checkout.session.completed": {
        const session = event.data.object;
        const metadata = session.metadata ?? {};
        const { organizationId, itemType, itemSlug } = metadata;

        const courseKind =
          metadata.kind === "course_purchase" ||
          metadata.kind === "course_public_purchase";
        if (courseKind && metadata.pendingId) {
          if (session.payment_status !== "paid") {
            console.warn(
              `[stripe/webhook] course_purchase ${metadata.pendingId} payment_status=${session.payment_status} — aguardando captura via payment_intent.succeeded.`,
            );
            break;
          }
          await processCoursePurchasePaid({
            pendingId: metadata.pendingId,
            amountTotalCents: session.amount_total,
            paymentIntentId:
              typeof session.payment_intent === "string"
                ? session.payment_intent
                : null,
            checkoutSessionId: session.id,
            source: "checkout.session.completed",
          });
          break;
        }

        // ── Legacy flow (organizationId in metadata) ──────────────────────────
        if (!organizationId) break;

        if (itemType === "topup") {
          await purchaseTopUp(organizationId, itemSlug);

          const posthog = getPostHogClient();
          posthog.capture({
            distinctId: organizationId,
            event: "stars_topup_purchased",
            properties: {
              organization_id: organizationId,
              item_type: itemType,
              item_slug: itemSlug,
              stripe_session_id: session.id,
            },
          });
          await posthog.shutdown();
        }

        break;
      }

      // ── Pagamento confirmado (fallback / async methods) ──────────────────────
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object;
        const paymentIntentMetadata = paymentIntent.metadata ?? {};
        let pendingId: string | null = paymentIntentMetadata.pendingId ?? null;
        if (!pendingId) {
          const pending = await prisma.pendingCoursePurchase.findFirst({
            where: { stripePaymentIntentId: paymentIntent.id },
            select: { id: true },
          });
          pendingId = pending?.id ?? null;
        }
        if (!pendingId) {
          break;
        }
        await processCoursePurchasePaid({
          pendingId,
          amountTotalCents:
            paymentIntent.amount_received ?? paymentIntent.amount ?? null,
          paymentIntentId: paymentIntent.id,
          checkoutSessionId: null,
          source: "payment_intent.succeeded",
        });
        break;
      }

      // ── Sessão expirada (timeout 24h sem pagar) ──────────────────────────────
      case "checkout.session.expired": {
        const session = event.data.object;
        const pendingId = session.metadata?.pendingId;
        if (!pendingId) {
          break;
        }
        const result = await prisma.pendingCoursePurchase.updateMany({
          where: { id: pendingId, status: "PENDING" },
          data: { status: "EXPIRED" },
        });
        console.log(
          `[stripe/webhook] checkout.session.expired pendingId=${pendingId} updated=${result.count}`,
        );
        break;
      }

      // ── Reembolso (manual via Dashboard ou via API) ──────────────────────────
      case "charge.refunded": {
        const charge = event.data.object;
        const paymentIntentId =
          typeof charge.payment_intent === "string"
            ? charge.payment_intent
            : null;
        if (!paymentIntentId) {
          console.warn("[stripe/webhook] charge.refunded sem payment_intent — ignorando.");
          break;
        }
        const isFullRefund =
          charge.refunded === true &&
          charge.amount_refunded >= charge.amount;
        if (!isFullRefund) {
          console.log(
            `[stripe/webhook] charge.refunded partial: pi=${paymentIntentId} refunded=${charge.amount_refunded}/${charge.amount} — não revoga (apenas log).`,
          );
          break;
        }

        const enrollment = await prisma.nasaRouteEnrollment.findFirst({
          where: { stripePaymentIntentId: paymentIntentId },
          select: {
            id: true,
            userId: true,
            courseId: true,
            status: true,
          },
        });
        if (!enrollment) {
          console.log(
            `[stripe/webhook] charge.refunded full mas enrollment não encontrado (pi=${paymentIntentId}) — ignorando.`,
          );
          break;
        }
        try {
          const { revokedNow, creatorClawbackStars } = await prisma.$transaction(
            async (tx) => {
              return revokeStripePurchaseInTx({
                tx: tx as any,
                enrollmentId: enrollment.id,
                reason: `Reembolso Stripe (charge=${charge.id})`,
              });
            },
          );
          console.log(
            `[stripe/webhook] charge.refunded ${revokedNow ? "applied" : "no-op (already refunded)"}: enrollment=${enrollment.id} clawback=${creatorClawbackStars}★`,
          );
          if (revokedNow) {
            await inngest
              .send({
                name: "nasa-route/enrollment.refunded",
                data: {
                  enrollmentId: enrollment.id,
                  userId: enrollment.userId,
                  courseId: enrollment.courseId,
                  chargeId: charge.id,
                  paymentIntentId,
                },
              })
              .catch((err) =>
                console.error(
                  "[stripe/webhook] inngest dispatch failed (refunded):",
                  err,
                ),
              );
          }
        } catch (err) {
          console.error("[stripe/webhook] revoke enrollment failed:", err);
          throw err;
        }
        break;
      }

      // ── Chargeback aberto pelo cliente no banco ─────────────────────────────
      case "charge.dispute.created": {
        const dispute = event.data.object;
        const charge =
          typeof dispute.charge === "string" ? dispute.charge : null;
        const paymentIntentId =
          typeof dispute.payment_intent === "string"
            ? dispute.payment_intent
            : null;
        console.warn(
          `[stripe/webhook] ⚠️ charge.dispute.created: dispute=${dispute.id} charge=${charge} pi=${paymentIntentId} reason=${dispute.reason} amount=${dispute.amount}`,
        );
        await inngest
          .send({
            name: "stripe/charge.dispute.created",
            data: {
              disputeId: dispute.id,
              chargeId: charge,
              paymentIntentId,
              reason: dispute.reason,
              amountCents: dispute.amount,
              currency: dispute.currency,
            },
          })
          .catch((err) =>
            console.error(
              "[stripe/webhook] inngest dispatch failed (dispute):",
              err,
            ),
          );
        break;
      }

      default:
        break;
    }

    // ── Modo Agente IA: dispara workflows com PAYMENT_RECEIVED ─────────
    // Best-effort — falha aqui NÃO derruba o webhook.
    if (
      event.type === "checkout.session.completed" ||
      event.type === "invoice.payment_succeeded" ||
      event.type === "payment_intent.succeeded"
    ) {
      const object = event.data.object as unknown as Record<string, unknown>;
      const metadata =
        (object.metadata as Record<string, string> | undefined) ?? {};
      const organizationId = metadata.organizationId;
      const leadId = metadata.leadId ?? null;
      const trackingId = metadata.trackingId ?? null;
      const externalId =
        (object.id as string) ?? (object.payment_intent as string) ?? "";
      const amount =
        typeof object.amount_total === "number"
          ? object.amount_total
          : typeof object.amount_paid === "number"
            ? object.amount_paid
            : undefined;

      if (organizationId && externalId) {
        try {
          const { dispatchPaymentReceived } = await import(
            "@/features/workflows/lib/agent-trigger-helpers"
          );
          await dispatchPaymentReceived({
            provider: "STRIPE",
            externalId,
            organizationId,
            trackingId,
            leadId,
            amount,
          });
        } catch (err) {
          console.error("[stripe/webhook] agent dispatch failed", err);
        }
      }
    }
  } catch (err) {
    console.error("[stripe/webhook] handler error:", err);
    return { status: 500, body: { error: "Erro interno." } };
  }

  return { status: 200, body: { received: true } };
}

// ───────────────────────────────────────────────────────────────────────────
// Helper compartilhado entre `checkout.session.completed` e
// `payment_intent.succeeded`. Idempotente — o segundo evento vira no-op.
// ───────────────────────────────────────────────────────────────────────────
async function processCoursePurchasePaid(opts: {
  pendingId: string;
  amountTotalCents: number | null;
  paymentIntentId: string | null;
  checkoutSessionId: string | null;
  source: "checkout.session.completed" | "payment_intent.succeeded";
}): Promise<void> {
  const { pendingId, amountTotalCents, paymentIntentId, source } = opts;

  const pending = await prisma.pendingCoursePurchase.findUnique({
    where: { id: pendingId },
    include: {
      course: {
        select: {
          id: true,
          title: true,
          creatorOrgId: true,
          purchaseTrackingId: true,
          purchaseStatusId: true,
        },
      },
      plan: { select: { id: true, name: true } },
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
      },
    },
  });
  if (!pending) {
    console.warn(
      `[stripe/webhook] ${source}: course_purchase pending not found:`,
      pendingId,
    );
    return;
  }

  const checkoutSessionId =
    opts.checkoutSessionId ?? pending.stripeSessionId ?? null;
  if (!checkoutSessionId) {
    console.error(
      `[stripe/webhook] ${source}: sem checkoutSessionId pra finalize (pending=${pendingId})`,
    );
    return;
  }

  const receivedBrlCents = amountTotalCents ?? pending.amountBrlCents;
  let effectivePriceStars = pending.priceStars;
  if (
    amountTotalCents !== null &&
    amountTotalCents !== pending.amountBrlCents
  ) {
    const ratio =
      pending.amountBrlCents > 0 ? amountTotalCents / pending.amountBrlCents : 1;
    effectivePriceStars = Math.max(0, Math.floor(pending.priceStars * ratio));
    console.warn(
      `[stripe/webhook] amount_total divergence pending=${pendingId} expected=${pending.amountBrlCents} got=${amountTotalCents} ratio=${ratio.toFixed(4)} priceStars=${pending.priceStars}→${effectivePriceStars}`,
    );
  }

  const claim = await prisma.pendingCoursePurchase.updateMany({
    where: { id: pendingId, status: "PENDING" },
    data: {
      status: "PAID",
      paidAt: new Date(),
      stripePaymentIntentId: paymentIntentId,
    },
  });
  if (claim.count === 0) {
    console.log(
      `[stripe/webhook] ${source}: pending ${pendingId} já PAID — verificando enrollment.`,
    );
  }

  if (pending.flow === "authenticated" && pending.userId && pending.plan) {
    try {
      const { enrollmentId, alreadyFinalized } = await prisma.$transaction(
        async (tx) => {
          const result = await finalizeStripePurchaseInTx({
            tx: tx as any,
            userId: pending.userId!,
            courseId: pending.courseId,
            courseTitle: pending.course.title,
            creatorOrgId: pending.course.creatorOrgId,
            planId: pending.plan!.id,
            planName: pending.plan!.name,
            paidBrlCents: receivedBrlCents,
            priceStarsSnapshot: effectivePriceStars,
            stripeCheckoutSessionId: checkoutSessionId,
            stripePaymentIntentId: paymentIntentId,
            buyerOrgId: null,
          });
          return {
            enrollmentId: result.enrollment.id,
            alreadyFinalized: result.alreadyFinalized === true,
          };
        },
      );

      if (!alreadyFinalized) {
        triggerPurchaseEmail(enrollmentId);
        if (pending.user) {
          createPurchaseSideEffects({
            buyer: {
              userId: pending.user.id,
              name: pending.user.name,
              email: pending.user.email,
              phone: pending.user.phone ?? null,
            },
            creatorOrgId: pending.course.creatorOrgId,
            createdByUserId: pending.user.id,
            course: {
              id: pending.course.id,
              title: pending.course.title,
              priceStars: effectivePriceStars,
              purchaseTrackingId: pending.course.purchaseTrackingId,
              purchaseStatusId: pending.course.purchaseStatusId,
            },
            planName: pending.plan!.name,
            enrollmentId: "",
          }).catch((err) =>
            console.error("[stripe/webhook] CRM side-effects failed:", err),
          );
        }
        const posthog = getPostHogClient();
        posthog.capture({
          distinctId: pending.userId!,
          event: "course_purchase_webhook_completed",
          properties: {
            course_id: pending.courseId,
            course_title: pending.course.title,
            plan_id: pending.plan!.id,
            plan_name: pending.plan!.name,
            amount_brl_cents: receivedBrlCents,
            flow: "authenticated",
            pending_id: pendingId,
            source,
          },
        });
        await posthog.shutdown();
      }

      console.log(
        `[stripe/webhook] ✅ ${source} course_purchase (auth) ${alreadyFinalized ? "no-op (already finalized)" : "finalized"}: pendingId=${pendingId}`,
      );
    } catch (err) {
      console.error(
        `[stripe/webhook] ${source}: failed to finalize authenticated purchase:`,
        err,
      );
      throw err;
    }
    return;
  }

  if (claim.count > 0) {
    const signupToken = randomBytes(32).toString("hex");
    const tokenExpiresAt = new Date(
      Date.now() + SIGNUP_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
    );
    await prisma.pendingCoursePurchase.update({
      where: { id: pendingId },
      data: {
        signupToken,
        tokenExpiresAt,
        priceStars: effectivePriceStars,
        amountBrlCents: receivedBrlCents,
      },
    });
    try {
      await inngest.send({
        name: "course/public-purchase.paid",
        data: { pendingId },
      });
    } catch (err) {
      console.error(
        `[stripe/webhook] ${source}: inngest dispatch failed (course public purchase):`,
        err,
      );
    }
    console.log(
      `[stripe/webhook] ✅ ${source} course_purchase (public) paid: pendingId=${pendingId}`,
    );
  } else {
    console.log(
      `[stripe/webhook] ${source} course_purchase (public) já tinha signupToken — no-op.`,
    );
  }
}
