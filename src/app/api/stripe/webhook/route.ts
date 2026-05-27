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
import { StarTransactionType } from "@/generated/prisma/client";
import { processPaymentPartnerEffects } from "@/features/partner/lib/partner-service";
import { inngest } from "@/inngest/client";
import { finalizeStripePurchaseInTx } from "@/app/router/nasa-route/helpers/purchase-helpers";
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
        const { organizationId, itemType, itemSlug, starsPaymentId } = metadata;

        // ── Compra de curso (kind=course_purchase) ───────────────────────────
        // Aceita também o nome legado "course_public_purchase" para
        // pendings criadas antes da unificação. Discrimina por `flow`:
        //  - "authenticated": cria enrollment direto pelo userId da pending.
        //  - "public" (default): gera signupToken + dispara email; resgate
        //    finaliza o enrollment quando o user cria conta.
        const courseKind =
          metadata.kind === "course_purchase" ||
          metadata.kind === "course_public_purchase";
        if (courseKind && metadata.pendingId) {
          const pendingId = metadata.pendingId;
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
              "[stripe/webhook] course_purchase pending not found:",
              pendingId,
            );
            break;
          }
          // Idempotência: webhook pode chegar duplicado
          if (pending.status === "PAID" || pending.status === "REDEEMED") {
            console.log(
              `[stripe/webhook] course_purchase ${pendingId} já em ${pending.status} — ignorando.`,
            );
            break;
          }

          const paymentIntentId =
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : null;

          // ── Fluxo authenticated: finaliza enrollment já ──────────────────
          if (pending.flow === "authenticated" && pending.userId && pending.plan) {
            try {
              const { enrollmentId } = await prisma.$transaction(async (tx) => {
                await tx.pendingCoursePurchase.update({
                  where: { id: pendingId },
                  data: {
                    status: "PAID",
                    paidAt: new Date(),
                    stripePaymentIntentId: paymentIntentId,
                  },
                });

                const { enrollment } = await finalizeStripePurchaseInTx({
                  tx: tx as any,
                  userId: pending.userId!,
                  courseId: pending.courseId,
                  courseTitle: pending.course.title,
                  creatorOrgId: pending.course.creatorOrgId,
                  planId: pending.plan!.id,
                  planName: pending.plan!.name,
                  paidBrlCents: pending.amountBrlCents,
                  priceStarsSnapshot: pending.priceStars,
                  stripeCheckoutSessionId: session.id,
                  stripePaymentIntentId: paymentIntentId,
                  buyerOrgId: null,
                });

                return { enrollmentId: enrollment.id };
              });

              // E-mail de pós-compra (Inngest, fire-and-forget)
              triggerPurchaseEmail(enrollmentId);

              // CRM side-effects (fire-and-forget)
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
                    priceStars: pending.priceStars,
                    purchaseTrackingId: pending.course.purchaseTrackingId,
                    purchaseStatusId: pending.course.purchaseStatusId,
                  },
                  planName: pending.plan!.name,
                  enrollmentId: "", // resolvido dentro do helper, opcional aqui
                }).catch((err) =>
                  console.error(
                    "[stripe/webhook] CRM side-effects failed:",
                    err,
                  ),
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
                  amount_brl_cents: pending.amountBrlCents,
                  flow: "authenticated",
                  pending_id: pendingId,
                },
              });
              await posthog.shutdown();

              console.log(
                `[stripe/webhook] ✅ course_purchase (auth) finalized: pendingId=${pendingId}`,
              );
            } catch (err) {
              console.error(
                "[stripe/webhook] failed to finalize authenticated purchase:",
                err,
              );
              throw err;
            }
            break;
          }

          // ── Fluxo public: gera signupToken pra o cadastro pós-pagamento ──
          const signupToken = randomBytes(32).toString("hex");
          const tokenExpiresAt = new Date(
            Date.now() + SIGNUP_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
          );

          await prisma.pendingCoursePurchase.update({
            where: { id: pendingId },
            data: {
              status: "PAID",
              paidAt: new Date(),
              signupToken,
              tokenExpiresAt,
              stripePaymentIntentId: paymentIntentId,
            },
          });

          try {
            await inngest.send({
              name: "course/public-purchase.paid",
              data: { pendingId },
            });
          } catch (err) {
            console.error(
              "[stripe/webhook] inngest dispatch failed (course public purchase):",
              err,
            );
          }

          console.log(
            `[stripe/webhook] ✅ course_purchase (public) paid: pendingId=${pendingId}`,
          );
          break;
        }

        // ── New Stars gateway checkout (starsPaymentId present) ──────────────
        if (starsPaymentId) {
          const sp = await prisma.starsPayment.findUnique({ where: { id: starsPaymentId } });
          if (sp && sp.status !== "paid") {
            await prisma.starsPayment.update({
              where: { id: starsPaymentId },
              data:  { status: "paid", externalId: session.id },
            });
            await purchaseTopUp(sp.organizationId, sp.packageId);

            // ── NASA Partner: comissão + auditoria de compra com desconto ──
            try {
              await processPaymentPartnerEffects(starsPaymentId);
            } catch (err) {
              console.error("[stripe/webhook] partner effects failed:", err);
            }

            const posthog = getPostHogClient();
            posthog.capture({
              distinctId: sp.organizationId,
              event: "stars_topup_purchased",
              properties: {
                organization_id: sp.organizationId,
                package_id: sp.packageId,
                stars_amount: sp.starsAmount,
                stars_payment_id: starsPaymentId,
              },
            });
            await posthog.shutdown();

            console.log(`[stripe/webhook] ✅ ${sp.starsAmount} stars credited via gateway checkout`);
          }
          break;
        }

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
  } catch (err) {
    console.error("[stripe/webhook] handler error:", err);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

// Stripe exige o body bruto — desabilita o body parser do Next.js
export const runtime = "nodejs";
