/**
 * POST /api/stripe/webhook
 *
 * Recebe eventos do Stripe e atualiza o banco de dados da plataforma NASA.
 *
 * Configurar no Stripe Dashboard:
 *   Endpoint URL: https://seudominio.com/api/stripe/webhook
 *   Eventos a ouvir:
 *     - checkout.session.completed
 *     - invoice.payment_succeeded   (renovação de plano)
 *     - customer.subscription.deleted (cancelamento)
 */

import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { constructWebhookEvent } from "@/lib/stripe";
import prisma from "@/lib/prisma";
import { purchaseTopUp, runMonthlyCycle } from "@/features/stars/lib/star-service";
import { inngest } from "@/inngest/client";
import {
  finalizeStripePurchaseInTx,
  revokeStripePurchaseInTx,
} from "@/app/router/nasa-route/helpers/purchase-helpers";
import { createPurchaseSideEffects } from "@/app/router/nasa-route/helpers/purchase-crm-side-effects";
import { triggerPurchaseEmail } from "@/features/nasa-route/lib/purchase-email";
import { getPostHogClient } from "@/lib/posthog-server";

const SIGNUP_TOKEN_TTL_DAYS = 7;

export async function POST(req: NextRequest) {
  const payload   = await req.text();
  const signature = req.headers.get("stripe-signature") ?? "";

  // ── Validate signature ─────────────────────────────────────────────────────
  // Endpoint dedicado a cursos — usa STRIPE_COURSE_WEBHOOK_SECRET. Mantém
  // fallback pra STRIPE_WEBHOOK_SECRET pra compat com ambientes antigos.
  const courseSecret =
    process.env.STRIPE_COURSE_WEBHOOK_SECRET ??
    process.env.STRIPE_WEBHOOK_SECRET;
  let event;
  try {
    event = constructWebhookEvent(payload, signature, courseSecret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Webhook error";
    console.error("[stripe/webhook] signature error:", msg);
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  // ── Handle events ──────────────────────────────────────────────────────────
  try {
    switch (event.type) {

      // ── Checkout concluído ───────────────────────────────────────────────────
      case "checkout.session.completed": {
        const session = event.data.object;
        const metadata = session.metadata ?? {};
        const { organizationId, itemType, itemSlug } = metadata;

        // ── Compra de curso (kind=course_purchase) ───────────────────────────
        // Aceita também o nome legado "course_public_purchase" para
        // pendings criadas antes da unificação.
        const courseKind =
          metadata.kind === "course_purchase" ||
          metadata.kind === "course_public_purchase";
        if (courseKind && metadata.pendingId) {
          // Defesa: payment_status. Métodos async (boleto/Pix) podem
          // disparar session.completed com payment_status="unpaid".
          // Nesse caso aguardamos o `payment_intent.succeeded` (handler
          // abaixo) que dispara após a captura real.
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

        // ── Recarga de Stars via Stripe ──────────────────────────────────────
        // Movida para o endpoint dedicado `/api/stars/webhook` (kind=stars_topup).
        // Este webhook não credita mais Stars do novo fluxo de gateway.

        // ── Legacy flow (organizationId in metadata) ──────────────────────────
        if (!organizationId) break;

        if (itemType === "plan") {
          // Busca o plano pelo slug e associa à org
          const plan = await prisma.plan.findUnique({ where: { slug: itemSlug } });
          if (plan) {
            const hasNoStars = (await prisma.organization.findUnique({
              where: { id: organizationId },
              select: { starsBalance: true, starsCycleStart: true },
            }))?.starsCycleStart === null;

            await prisma.organization.update({
              where: { id: organizationId },
              data: {
                planId: plan.id,
                // Iniciar ciclo se for a primeira vez
                ...(hasNoStars && { starsCycleStart: new Date() }),
              },
            });

            // Creditar stars do plano se for primeiro ciclo
            if (hasNoStars) {
              await runMonthlyCycle(organizationId);
            }
          }
        } else if (itemType === "topup") {
          // itemSlug é o packageId
          await purchaseTopUp(organizationId, itemSlug);
        }

        if (itemType === "plan" || itemType === "topup") {
          const posthog = getPostHogClient();
          posthog.capture({
            distinctId: organizationId,
            event: itemType === "plan" ? "plan_purchased" : "stars_topup_purchased",
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
      // Backup do checkout.session.completed: se o session.completed falhou na
      // entrega (servidor down, 500, etc.) OU se foi um método async (boleto/Pix)
      // que só captura depois, este evento dispara após captura real e finaliza
      // a compra. `processCoursePurchasePaid` é idempotente — se o session.completed
      // já tiver processado, este vira no-op.
      case "payment_intent.succeeded": {
        const pi = event.data.object;
        const piMetadata = pi.metadata ?? {};
        // Se o PI tem metadata de course_purchase (propagamos via
        // payment_intent_data.metadata na criação da session), vai direto.
        // Caso contrário, tenta lookup por stripePaymentIntentId no DB
        // (pendings antigas que foram criadas antes do propagate metadata).
        let pendingId: string | null = piMetadata.pendingId ?? null;
        if (!pendingId) {
          const pending = await prisma.pendingCoursePurchase.findFirst({
            where: { stripePaymentIntentId: pi.id },
            select: { id: true },
          });
          pendingId = pending?.id ?? null;
        }
        if (!pendingId) {
          // PI alheio (Stars top-up, plan subscription, etc.) — ignore.
          break;
        }
        await processCoursePurchasePaid({
          pendingId,
          amountTotalCents: pi.amount_received ?? pi.amount ?? null,
          paymentIntentId: pi.id,
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
          // Stars top-up / plano não trackeiam expiração no DB ainda.
          break;
        }
        // Claim atômica: só marca EXPIRED se ainda estava PENDING.
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
      // Stripe envia este evento DEPOIS que o refund é processado. Pode ser
      // total (charge.refunded === true) ou parcial. Para refund total:
      // revoga acesso ao curso + debita Stars do criador.
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
          // Refund parcial: por enquanto só logamos. Revogar acesso por
          // valor parcial pode confundir; ação manual via admin é mais segura.
          console.log(
            `[stripe/webhook] charge.refunded partial: pi=${paymentIntentId} refunded=${charge.amount_refunded}/${charge.amount} — não revoga (apenas log).`,
          );
          break;
        }

        // Lookup enrollment por PI.
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
          // Pode ser refund de Stars top-up, plan, etc. — ignore.
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
            // Notificação assíncrona: aluno + criador (Inngest).
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
      // NÃO revoga acesso automaticamente: o merchant pode contestar e vencer.
      // Só loga + dispara evento para o admin tratar (UI manual ou Inngest).
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
        // Inngest: notifica admin pra ação manual (e-mail/Slack/etc.)
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

      // ── Renovação de assinatura (nova fatura paga) ───────────────────────────
      case "invoice.payment_succeeded": {
        const invoice = event.data.object;
        const customerId = typeof invoice.customer === "string" ? invoice.customer : null;
        // TODO: mapear customerId → organizationId após salvar stripeCustomerId na org
        // Por ora, apenas loga
        console.log("[stripe/webhook] invoice paid for customer:", customerId);
        break;
      }

      // ── Cancelamento de assinatura ───────────────────────────────────────────
      case "customer.subscription.deleted": {
        const sub = event.data.object;
        const customerId = typeof sub.customer === "string" ? sub.customer : null;
        // TODO: remover plano da org ao cancelar
        console.log("[stripe/webhook] subscription cancelled for customer:", customerId);
        break;
      }

      default:
        // Ignorar eventos não tratados
        break;
    }

    // ── Modo Agente IA: dispara workflows com PAYMENT_RECEIVED ─────────
    // Best-effort — falha aqui NÃO derruba o webhook. Inngest function
    // `agentTriggerPaymentReceivedFn` consome e fan-out.
    if (
      event.type === "checkout.session.completed" ||
      event.type === "invoice.payment_succeeded" ||
      event.type === "payment_intent.succeeded"
    ) {
      const obj = event.data.object as Record<string, unknown>;
      const metadata = (obj.metadata as Record<string, string> | undefined) ?? {};
      const organizationId = metadata.organizationId;
      const leadId = metadata.leadId ?? null;
      const trackingId = metadata.trackingId ?? null;
      const externalId =
        (obj.id as string) ?? (obj.payment_intent as string) ?? "";
      const amount =
        typeof obj.amount_total === "number"
          ? obj.amount_total
          : typeof obj.amount_paid === "number"
            ? obj.amount_paid
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
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

// Stripe exige o body bruto — desabilita o body parser do Next.js
export const runtime = "nodejs";

// ───────────────────────────────────────────────────────────────────────────
// Helper compartilhado entre `checkout.session.completed` e
// `payment_intent.succeeded`. Centraliza claim atômica + validação de
// amount + finalize + side-effects. Idempotente — pode ser chamado por
// ambos os eventos, o segundo vira no-op.
// ───────────────────────────────────────────────────────────────────────────
async function processCoursePurchasePaid(opts: {
  pendingId: string;
  /** Valor recebido pelo Stripe em centavos (amount_total ou amount_received).
   *  Quando null, usamos o snapshot do pending como fallback. */
  amountTotalCents: number | null;
  paymentIntentId: string | null;
  /** ID da Stripe Session. Quando chamado de payment_intent.succeeded,
   *  pode ser null — vamos buscar do pending.stripeSessionId. */
  checkoutSessionId: string | null;
  /** Para logs — qual evento Stripe disparou esta chamada. */
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

  // Determina sessionId — preferimos o do evento; fallback pro pending.
  const checkoutSessionId =
    opts.checkoutSessionId ?? pending.stripeSessionId ?? null;
  if (!checkoutSessionId) {
    console.error(
      `[stripe/webhook] ${source}: sem checkoutSessionId pra finalize (pending=${pendingId})`,
    );
    return;
  }

  // ── Defesa: amount_total ─────────────────────────────────────────────
  // Se cupom Stripe foi aplicado ou divergir de qualquer forma, recalcula
  // o priceStarsSnapshot proporcional ao valor REAL recebido.
  const receivedBrlCents = amountTotalCents ?? pending.amountBrlCents;
  let effectivePriceStars = pending.priceStars;
  if (
    amountTotalCents !== null &&
    amountTotalCents !== pending.amountBrlCents
  ) {
    const ratio =
      pending.amountBrlCents > 0 ? amountTotalCents / pending.amountBrlCents : 1;
    effectivePriceStars = Math.max(
      0,
      Math.floor(pending.priceStars * ratio),
    );
    console.warn(
      `[stripe/webhook] amount_total divergence pending=${pendingId} expected=${pending.amountBrlCents} got=${amountTotalCents} ratio=${ratio.toFixed(4)} priceStars=${pending.priceStars}→${effectivePriceStars}`,
    );
  }

  // ── Claim atômica: PENDING → PAID ────────────────────────────────────
  // Se outro processo (event paralelo, retry) já moveu para PAID/REDEEMED,
  // count===0 e saímos sem refazer side-effects.
  const claim = await prisma.pendingCoursePurchase.updateMany({
    where: { id: pendingId, status: "PENDING" },
    data: {
      status: "PAID",
      paidAt: new Date(),
      stripePaymentIntentId: paymentIntentId,
    },
  });
  if (claim.count === 0) {
    // Pode ser:
    //  (a) duplicate delivery do mesmo evento (idempotente).
    //  (b) este é payment_intent.succeeded mas o session.completed já
    //      processou (ou vice-versa).
    // Em qualquer caso, ainda chamamos finalize pra garantir enrollment
    // (que tem seu próprio guard de idempotência via stripeCheckoutSessionId).
    // Isso cobre o caso (b) onde o enrollment talvez não exista ainda
    // se a primeira execução falhou no meio.
    console.log(
      `[stripe/webhook] ${source}: pending ${pendingId} já PAID — verificando enrollment.`,
    );
  }

  // ── Fluxo authenticated: finaliza enrollment já ─────────────────────
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

  // ── Fluxo public: gera signupToken (apenas se claim foi nova) ─────────
  // Se já foi PAID antes (claim.count===0), o signupToken já existe —
  // não regeramos pra não invalidar links de e-mail já enviados.
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
