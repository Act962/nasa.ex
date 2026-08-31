/**
 * POST /api/trafego/webhook
 *
 * Webhook DEDICADO ao trafeGO. Separado de `/api/stripe/webhook` (cursos) e
 * `/api/stars/webhook` pelo mesmo motivo que eles são separados entre si: um
 * throw no handler devolve 500 para o endpoint inteiro e o Stripe reentrega
 * TODOS os eventos daquele endpoint, inclusive de produtos que não falharam.
 *
 * Configurar no Stripe Dashboard:
 *   Endpoint URL: https://seudominio.com/api/trafego/webhook
 *   Secret: STRIPE_TRAFEGO_WEBHOOK_SECRET
 *   Eventos:
 *     - checkout.session.completed
 *     - payment_intent.succeeded     (fallback + métodos assíncronos)
 *     - checkout.session.expired
 *     - charge.refunded
 *     - charge.dispute.created
 */

import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { constructWebhookEvent } from "@/lib/stripe";
import prisma from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { inngest } from "@/inngest/client";
import { getPostHogClient } from "@/lib/posthog-server";
import { createTrafegoOrderFromPurchaseInTx } from "@/features/trafego/server/lib/create-order-from-purchase";

const SIGNUP_TOKEN_TTL_DAYS = 7;

/** P2002 = unique violation → evento já processado. */
function isDuplicateEvent(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
  );
}

/**
 * Dedupe por event.id. Gravamos ANTES de processar e removemos o registro se o
 * processamento falhar — assim uma falha real volta a ser reentregável pelo
 * Stripe, em vez de ser engolida pelo dedupe.
 */
async function claimEventOnce(eventId: string, type: string): Promise<boolean> {
  try {
    await prisma.processedStripeEvent.create({
      data: { id: eventId, type, source: "trafego" },
    });
    return true;
  } catch (error) {
    if (isDuplicateEvent(error)) return false;
    throw error;
  }
}

async function releaseEvent(eventId: string): Promise<void> {
  await prisma.processedStripeEvent
    .delete({ where: { id: eventId } })
    .catch(() => {});
}

export async function POST(req: NextRequest) {
  const payload = await req.text();
  const signature = req.headers.get("stripe-signature") ?? "";

  let event;
  try {
    event = constructWebhookEvent(
      payload,
      signature,
      process.env.STRIPE_TRAFEGO_WEBHOOK_SECRET,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook error";
    console.error("[trafego/webhook] assinatura inválida:", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const isFirstDelivery = await claimEventOnce(event.id, event.type);
  if (!isFirstDelivery) {
    return NextResponse.json({ received: true, deduped: true });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const metadata = session.metadata ?? {};
        if (metadata.kind !== "trafego_order" || !metadata.pendingId) break;

        // Boleto/Pix disparam `completed` com payment_status "unpaid" — a
        // captura real vem no payment_intent.succeeded.
        if (session.payment_status !== "paid") {
          console.warn(
            `[trafego/webhook] pending ${metadata.pendingId} payment_status=${session.payment_status} — aguardando captura.`,
          );
          break;
        }

        await processTrafegoPurchasePaid({
          pendingId: metadata.pendingId,
          amountTotalCents: session.amount_total,
          paymentIntentId:
            typeof session.payment_intent === "string" ? session.payment_intent : null,
          checkoutSessionId: session.id,
          source: "checkout.session.completed",
        });
        break;
      }

      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object;
        const metadata = paymentIntent.metadata ?? {};

        let pendingId: string | null =
          metadata.kind === "trafego_order" ? (metadata.pendingId ?? null) : null;

        if (!pendingId) {
          // Pendings antigas, criadas antes do metadata propagar pro PI.
          const pending = await prisma.trafegoPendingPurchase.findFirst({
            where: { stripePaymentIntentId: paymentIntent.id },
            select: { id: true },
          });
          pendingId = pending?.id ?? null;
        }
        if (!pendingId) break; // PI de outro produto — ignora.

        await processTrafegoPurchasePaid({
          pendingId,
          amountTotalCents: paymentIntent.amount_received ?? paymentIntent.amount ?? null,
          paymentIntentId: paymentIntent.id,
          checkoutSessionId: null,
          source: "payment_intent.succeeded",
        });
        break;
      }

      case "checkout.session.expired": {
        const session = event.data.object;
        const metadata = session.metadata ?? {};
        if (metadata.kind !== "trafego_order" || !metadata.pendingId) break;

        await prisma.trafegoPendingPurchase.updateMany({
          where: { id: metadata.pendingId, status: "PENDING" },
          data: { status: "EXPIRED" },
        });
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object;
        const metadata = charge.metadata ?? {};
        const paymentIntentId =
          typeof charge.payment_intent === "string" ? charge.payment_intent : null;

        const pending =
          metadata.kind === "trafego_order" && metadata.pendingId
            ? await prisma.trafegoPendingPurchase.findUnique({
                where: { id: metadata.pendingId },
                select: { id: true, amountBrlCents: true },
              })
            : paymentIntentId
              ? await prisma.trafegoPendingPurchase.findFirst({
                  where: { stripePaymentIntentId: paymentIntentId },
                  select: { id: true, amountBrlCents: true },
                })
              : null;
        if (!pending) break;

        // Reembolso parcial não revoga a campanha — a equipe decide no painel.
        const isFullRefund = charge.amount_refunded >= charge.amount;
        if (!isFullRefund) {
          console.warn(
            `[trafego/webhook] reembolso parcial em ${pending.id} — nenhuma ação automática.`,
          );
          break;
        }

        await revokeTrafegoPurchase(pending.id);
        break;
      }

      case "charge.dispute.created": {
        // Só registra: disputa não revoga acesso automaticamente.
        console.warn("[trafego/webhook] disputa aberta:", event.data.object.id);
        break;
      }

      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    // Solta o dedupe pra que o Stripe possa reentregar — senão a falha some.
    await releaseEvent(event.id);
    console.error(`[trafego/webhook] falha em ${event.type}:`, error);
    return NextResponse.json({ error: "Erro ao processar webhook." }, { status: 500 });
  }
}

interface ProcessPaidOptions {
  pendingId: string;
  amountTotalCents: number | null;
  paymentIntentId: string | null;
  checkoutSessionId: string | null;
  source: string;
}

/**
 * Confirma o pagamento de uma compra trafeGO. Idempotente: o claim atômico
 * `PENDING → PAID` garante que só a primeira execução gera o token de ativação.
 */
async function processTrafegoPurchasePaid(options: ProcessPaidOptions): Promise<void> {
  const { pendingId, amountTotalCents, paymentIntentId, checkoutSessionId, source } =
    options;

  const pending = await prisma.trafegoPendingPurchase.findUnique({
    where: { id: pendingId },
    select: {
      id: true,
      email: true,
      flow: true,
      userId: true,
      status: true,
      amountBrlCents: true,
      signupToken: true,
      platform: true,
      objective: true,
    },
  });
  if (!pending) {
    console.warn(`[trafego/webhook] ${source}: pending não encontrada: ${pendingId}`);
    return;
  }

  // Divergência de valor: gravamos o recebido e SINALIZAMOS. Reescalar a verba
  // em silêncio seria pior — ela é dinheiro que vai ser investido no anúncio
  // (spec 0008 CA-14).
  const hasMismatch =
    amountTotalCents !== null && amountTotalCents !== pending.amountBrlCents;
  if (hasMismatch) {
    console.warn(
      `[trafego/webhook] divergência de valor em ${pendingId}: esperado=${pending.amountBrlCents} recebido=${amountTotalCents}`,
    );
  }

  const claim = await prisma.trafegoPendingPurchase.updateMany({
    where: { id: pendingId, status: "PENDING" },
    data: {
      status: "PAID",
      paidAt: new Date(),
      stripePaymentIntentId: paymentIntentId,
      ...(checkoutSessionId ? { stripeSessionId: checkoutSessionId } : {}),
      ...(hasMismatch ? { amountMismatch: true } : {}),
    },
  });

  if (claim.count === 0) {
    console.log(`[trafego/webhook] ${source}: ${pendingId} já estava PAID — no-op.`);
    return;
  }

  // Fluxo autenticado: a conta já existe, então o pedido nasce agora.
  if (pending.flow === "authenticated" && pending.userId) {
    const member = await prisma.member.findFirst({
      where: { userId: pending.userId },
      select: { organizationId: true },
      orderBy: { createdAt: "asc" },
    });

    if (member) {
      await prisma.$transaction(async (tx) =>
        createTrafegoOrderFromPurchaseInTx({
          tx,
          pendingPurchaseId: pending.id,
          organizationId: member.organizationId,
          ownerUserId: pending.userId!,
        }),
      );
      await prisma.trafegoPendingPurchase.update({
        where: { id: pending.id },
        data: { status: "REDEEMED" },
      });
      console.log(`[trafego/webhook] ✅ ${source} pedido criado (auth): ${pendingId}`);
      return;
    }
    console.warn(
      `[trafego/webhook] ${pendingId} flow=authenticated sem organização — caindo no fluxo de token.`,
    );
  }

  // Fluxo público: gera o token de ativação e dispara o e-mail.
  const signupToken = randomBytes(32).toString("hex");
  await prisma.trafegoPendingPurchase.update({
    where: { id: pending.id },
    data: {
      signupToken,
      tokenExpiresAt: new Date(
        Date.now() + SIGNUP_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
      ),
    },
  });

  try {
    await inngest.send({ name: "trafego/purchase.paid", data: { pendingId } });
  } catch (error) {
    console.error(`[trafego/webhook] ${source}: dispatch Inngest falhou:`, error);
  }

  const posthog = getPostHogClient();
  posthog.capture({
    distinctId: pending.email,
    event: "trafego_purchase_paid",
    properties: {
      pending_id: pendingId,
      platform: pending.platform,
      objective: pending.objective,
      amount_brl_cents: amountTotalCents ?? pending.amountBrlCents,
      amount_mismatch: hasMismatch,
      source,
    },
  });
  await posthog.shutdown();

  console.log(`[trafego/webhook] ✅ ${source} pago (public): ${pendingId}`);
}

async function revokeTrafegoPurchase(pendingId: string): Promise<void> {
  await prisma.trafegoPendingPurchase.update({
    where: { id: pendingId },
    data: { status: "REFUNDED" },
  });

  const order = await prisma.trafegoOrder.findUnique({
    where: { pendingPurchaseId: pendingId },
    select: { id: true, status: true },
  });
  if (!order) return;

  // Criativos e histórico ficam — o cliente pode contestar, e a equipe precisa
  // do rastro.
  await prisma.trafegoOrder.update({
    where: { id: order.id },
    data: { status: "REFUNDED" },
  });
  await prisma.trafegoOrderEvent.create({
    data: {
      orderId: order.id,
      fromStatus: order.status,
      toStatus: "REFUNDED",
      title: "Pagamento reembolsado",
      detail: "O pagamento desta campanha foi reembolsado integralmente.",
    },
  });
}
