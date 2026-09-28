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
import {
  claimStripeEvent,
  constructWebhookEvent,
  releaseStripeEvent,
} from "@/lib/stripe";
import prisma from "@/lib/prisma";
import { markTrafegoPurchasePaid } from "@/features/trafego/server/lib/mark-purchase-paid";
import { transitionTrafegoOrder } from "@/features/trafego/server/lib/transition-order";

export async function POST(req: NextRequest) {
  // Fail-closed: exigimos o secret dedicado. Passar `undefined` adiante faria
  // `constructWebhookEvent` cair no STRIPE_WEBHOOK_SECRET compartilhado
  // (better-auth / planos) — validar evento de trafeGO com o secret de outro
  // produto aceitaria como legítimo um evento que não é nosso.
  const secret = process.env.STRIPE_TRAFEGO_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[trafego/webhook] STRIPE_TRAFEGO_WEBHOOK_SECRET não configurado.");
    return NextResponse.json({ error: "Webhook não configurado." }, { status: 500 });
  }

  const payload = await req.text();
  const signature = req.headers.get("stripe-signature") ?? "";

  let event;
  try {
    event = constructWebhookEvent(payload, signature, secret);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook error";
    console.error("[trafego/webhook] assinatura inválida:", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // Dedupe: gravamos ANTES de processar e soltamos em caso de falha, para que
  // um erro real continue reentregável pelo Stripe.
  const isFirstDelivery = await claimStripeEvent(event.id, event.type, "trafego");
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
    await releaseStripeEvent(event.id);
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
 * Adapta o evento do Stripe para o caminho único de confirmação
 * (`markTrafegoPurchasePaid`), que o "Confirmar PIX" também usa. O claim
 * atômico lá dentro é o que garante idempotência entre os dois.
 */
async function processTrafegoPurchasePaid(options: ProcessPaidOptions): Promise<void> {
  await markTrafegoPurchasePaid({
    pendingId: options.pendingId,
    paymentSource: "stripe",
    amountTotalCents: options.amountTotalCents,
    stripe: {
      paymentIntentId: options.paymentIntentId,
      checkoutSessionId: options.checkoutSessionId,
    },
    // Stripe só confirma pendência ainda aberta. Compra expirada que recebe
    // pagamento tardio é caso de conferência humana, não de crédito automático.
    claimFromStatuses: ["PENDING"],
  });
}

async function revokeTrafegoPurchase(pendingId: string): Promise<void> {
  await prisma.trafegoPendingPurchase.update({
    where: { id: pendingId },
    data: { status: "REFUNDED" },
  });

  const order = await prisma.trafegoOrder.findUnique({
    where: { pendingPurchaseId: pendingId },
    select: { id: true },
  });
  if (!order) return;

  // Criativos e histórico ficam — o cliente pode contestar, e a equipe precisa
  // do rastro. O card vira perdido pela própria transição.
  await transitionTrafegoOrder({
    orderId: order.id,
    toStatus: "REFUNDED",
    source: "SYSTEM",
    title: "Pagamento reembolsado",
    clientNote: "O pagamento desta campanha foi reembolsado integralmente.",
  });
}
