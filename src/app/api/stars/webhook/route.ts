/**
 * POST /api/stars/webhook
 *
 * Webhook DEDICADO à recarga de Stars via Stripe. Separado de
 * `/api/stripe/webhook` (cursos / better-auth) pra isolar responsabilidades.
 *
 * Configurar no Stripe Dashboard:
 *   Endpoint URL: https://seudominio.com/api/stars/webhook
 *   Eventos:
 *     - checkout.session.completed
 *     - payment_intent.succeeded   (fallback / métodos async)
 *     - checkout.session.expired
 *     - charge.refunded
 *     - charge.dispute.created
 *
 * Secret de assinatura: `STRIPE_STARS_WEBHOOK_SECRET` (Stripe do sistema).
 */

import { NextRequest, NextResponse } from "next/server";
import { constructWebhookEvent } from "@/lib/stripe";
import prisma from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import {
  finalizeStarsTopUpInTx,
  revertStarsTopUpInTx,
} from "@/features/stars/lib/stars-topup-helpers";
import { processPaymentPartnerEffects } from "@/features/partner/lib/partner-service";
import { inngest } from "@/inngest/client";
import { getPostHogClient } from "@/lib/posthog-server";

/** P2002 = unique constraint → evento já processado (duplicata). */
function isDuplicateEvent(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002"
  );
}

/** Registra o event.id pra dedupe; retorna false se já existia. */
async function recordEventOnce(eventId: string, type: string): Promise<boolean> {
  try {
    await prisma.processedStripeEvent.create({
      data: { id: eventId, type, source: "stars" },
    });
    return true;
  } catch (err) {
    if (isDuplicateEvent(err)) return false;
    throw err;
  }
}

async function emitPurchaseAnalytics(
  organizationId: string,
  starsPaymentId: string,
  effectiveStars: number,
): Promise<void> {
  const posthog = getPostHogClient();
  posthog.capture({
    distinctId: organizationId,
    event: "stars_topup_purchased",
    properties: {
      organization_id: organizationId,
      stars_payment_id: starsPaymentId,
      stars_amount: effectiveStars,
      gateway: "stripe",
    },
  });
  await posthog.shutdown();
}

/** Finaliza um pagamento + side-effects. Trata duplicata como no-op (200). */
async function finalizeAndSideEffects(opts: {
  eventId: string;
  eventType: string;
  starsPaymentId: string;
  receivedBrlCents: number | null;
}): Promise<void> {
  const { eventId, eventType, starsPaymentId, receivedBrlCents } = opts;
  try {
    const result = await prisma.$transaction((tx) =>
      finalizeStarsTopUpInTx({
        tx,
        eventId,
        eventType,
        starsPaymentId,
        receivedBrlCents,
      }),
    );

    if (result.alreadyFinalized) {
      console.log(
        `[stars/webhook] ${eventType}: payment ${starsPaymentId} já finalizado — no-op.`,
      );
      return;
    }

    const payment = await prisma.starsPayment.findUnique({
      where: { id: starsPaymentId },
      select: { organizationId: true },
    });

    try {
      await processPaymentPartnerEffects(starsPaymentId);
    } catch (err) {
      console.error("[stars/webhook] partner effects failed:", err);
    }

    if (payment) {
      await emitPurchaseAnalytics(
        payment.organizationId,
        starsPaymentId,
        result.effectiveStars,
      );
    }

    console.log(
      `[stars/webhook] ✅ ${result.effectiveStars} ★ creditadas (payment=${starsPaymentId})`,
    );
  } catch (err) {
    if (isDuplicateEvent(err)) {
      console.log(
        `[stars/webhook] ${eventType} ${eventId}: evento duplicado — no-op.`,
      );
      return;
    }
    throw err;
  }
}

export async function POST(req: NextRequest) {
  const payload = await req.text();
  const signature = req.headers.get("stripe-signature") ?? "";

  // ── Secret de assinatura do sistema (fail-closed) ──────────────────────────
  // Exigimos o secret dedicado. NÃO caímos no STRIPE_WEBHOOK_SECRET compartilhado
  // — verificar eventos de Stars com o secret errado seria uma brecha.
  const secret = process.env.STRIPE_STARS_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[stars/webhook] STRIPE_STARS_WEBHOOK_SECRET não configurado.");
    return NextResponse.json(
      { error: "Webhook não configurado." },
      { status: 500 },
    );
  }

  let event;
  try {
    event = constructWebhookEvent(payload, signature, secret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Webhook error";
    console.error("[stars/webhook] signature error:", msg);
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  try {
    switch (event.type) {
      // ── Checkout concluído ────────────────────────────────────────────────
      case "checkout.session.completed": {
        const session = event.data.object;
        const metadata = session.metadata ?? {};
        if (metadata.kind !== "stars_topup") break;

        const starsPaymentId = metadata.starsPaymentId;
        if (!starsPaymentId) break;

        // Métodos async podem disparar com payment_status="unpaid" —
        // aguardamos o `payment_intent.succeeded`.
        if (session.payment_status !== "paid") {
          console.warn(
            `[stars/webhook] checkout ${starsPaymentId} payment_status=${session.payment_status} — aguardando payment_intent.succeeded.`,
          );
          break;
        }

        // Guarda o PI pro lookup do charge.refunded.
        const piId =
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : null;
        if (piId) {
          await prisma.starsPayment.update({
            where: { id: starsPaymentId },
            data: { stripePaymentIntentId: piId },
          });
        }

        await finalizeAndSideEffects({
          eventId: event.id,
          eventType: event.type,
          starsPaymentId,
          receivedBrlCents: session.amount_total,
        });
        break;
      }

      // ── Pagamento confirmado (fallback / async) ───────────────────────────
      case "payment_intent.succeeded": {
        const pi = event.data.object;
        const piMetadata = pi.metadata ?? {};

        let starsPaymentId: string | null =
          piMetadata.kind === "stars_topup"
            ? piMetadata.starsPaymentId ?? null
            : null;
        if (!starsPaymentId) {
          const sp = await prisma.starsPayment.findFirst({
            where: { stripePaymentIntentId: pi.id, provider: "stripe" },
            select: { id: true },
          });
          starsPaymentId = sp?.id ?? null;
        }
        if (!starsPaymentId) break; // PI alheio — ignore.

        await finalizeAndSideEffects({
          eventId: event.id,
          eventType: event.type,
          starsPaymentId,
          receivedBrlCents: pi.amount_received ?? pi.amount ?? null,
        });
        break;
      }

      // ── Sessão expirada ───────────────────────────────────────────────────
      case "checkout.session.expired": {
        const session = event.data.object;
        if (session.metadata?.kind !== "stars_topup") break;
        if (!(await recordEventOnce(event.id, event.type))) break;
        const result = await prisma.starsPayment.updateMany({
          where: { externalId: session.id, status: "pending" },
          data: { status: "expired" },
        });
        console.log(
          `[stars/webhook] checkout.session.expired session=${session.id} updated=${result.count}`,
        );
        break;
      }

      // ── Reembolso ─────────────────────────────────────────────────────────
      case "charge.refunded": {
        const charge = event.data.object;
        const piId =
          typeof charge.payment_intent === "string"
            ? charge.payment_intent
            : null;
        if (!piId) break;

        const isFullRefund =
          charge.refunded === true && charge.amount_refunded >= charge.amount;
        if (!isFullRefund) {
          console.log(
            `[stars/webhook] charge.refunded parcial pi=${piId} ${charge.amount_refunded}/${charge.amount} — só log.`,
          );
          break;
        }

        const sp = await prisma.starsPayment.findFirst({
          where: { stripePaymentIntentId: piId, provider: "stripe" },
          select: { id: true },
        });
        if (!sp) break; // refund alheio (curso/plano) — ignore.

        try {
          const { revertedNow, reverted } = await prisma.$transaction((tx) =>
            revertStarsTopUpInTx({
              tx,
              eventId: event.id,
              eventType: event.type,
              starsPaymentId: sp.id,
              reason: `Reembolso Stripe (charge=${charge.id})`,
            }),
          );
          console.log(
            `[stars/webhook] charge.refunded ${revertedNow ? "aplicado" : "no-op"}: payment=${sp.id} estorno=${reverted}★`,
          );
        } catch (err) {
          if (isDuplicateEvent(err)) break;
          throw err;
        }
        break;
      }

      // ── Chargeback ────────────────────────────────────────────────────────
      // Não reverte: o merchant pode contestar. Só notifica pra ação manual.
      case "charge.dispute.created": {
        const dispute = event.data.object;
        if (!(await recordEventOnce(event.id, event.type))) break;
        console.warn(
          `[stars/webhook] ⚠️ charge.dispute.created dispute=${dispute.id} reason=${dispute.reason} amount=${dispute.amount}`,
        );
        await inngest
          .send({
            name: "stripe/charge.dispute.created",
            data: {
              disputeId: dispute.id,
              chargeId:
                typeof dispute.charge === "string" ? dispute.charge : null,
              paymentIntentId:
                typeof dispute.payment_intent === "string"
                  ? dispute.payment_intent
                  : null,
              reason: dispute.reason,
              amountCents: dispute.amount,
              currency: dispute.currency,
              source: "stars",
            },
          })
          .catch((err) =>
            console.error("[stars/webhook] inngest dispatch failed:", err),
          );
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error("[stars/webhook] handler error:", err);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

export const runtime = "nodejs";
