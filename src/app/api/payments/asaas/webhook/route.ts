/**
 * POST /api/payments/asaas/webhook
 *
 * Recebe notificações de pagamento da Asaas e credita Stars ao usuário.
 *
 * Configurar no painel Asaas:
 *   Configurações → Notificações (Webhooks) → Adicionar URL:
 *   https://seudominio.com/api/payments/asaas/webhook
 *   Eventos: PAYMENT_RECEIVED, PAYMENT_CONFIRMED
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { purchaseTopUp } from "@/features/stars/lib/star-service";
import { processPaymentPartnerEffects } from "@/features/partner/lib/partner-service";

interface AsaasWebhookPayload {
  event:   string;  // "PAYMENT_RECEIVED" | "PAYMENT_CONFIRMED" | etc.
  payment: {
    id:                string;
    status:            string;
    value:             number;
    externalReference: string | null;
  };
}

export async function POST(req: NextRequest) {
  let payload: AsaasWebhookPayload;

  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { event, payment } = payload;

  // Only process confirmed payments
  if (event !== "PAYMENT_RECEIVED" && event !== "PAYMENT_CONFIRMED") {
    return NextResponse.json({ received: true, skipped: true });
  }

  const paymentId = payment.externalReference;
  if (!paymentId) {
    console.warn("[asaas/webhook] no externalReference in payment", payment.id);
    return NextResponse.json({ received: true });
  }

  try {
    // Find the StarsPayment record
    const starsPayment = await prisma.starsPayment.findUnique({
      where: { id: paymentId },
    });

    if (!starsPayment) {
      console.warn("[asaas/webhook] StarsPayment not found:", paymentId);
      return NextResponse.json({ received: true });
    }

    // Idempotency: skip if already processed
    if (starsPayment.status === "paid") {
      return NextResponse.json({ received: true, alreadyProcessed: true });
    }

    // Asaas só lida com top-up por pacote (createGatewayCheckout sempre seta
    // packageId). Compra com quantidade customizada (packageId null) é Stripe-only.
    if (!starsPayment.packageId) {
      console.warn(
        "[asaas/webhook] StarsPayment sem packageId — fora do fluxo Asaas:",
        paymentId,
      );
      return NextResponse.json({ received: true });
    }

    // Mark as paid
    await prisma.starsPayment.update({
      where: { id: paymentId },
      data:  { status: "paid", externalId: payment.id },
    });

    // Credit stars to the organization
    await purchaseTopUp(starsPayment.organizationId, starsPayment.packageId);

    // ── NASA Partner: comissão + auditoria de compra com desconto ──
    try {
      await processPaymentPartnerEffects(starsPayment.id);
    } catch (err) {
      console.error("[asaas/webhook] partner effects failed:", err);
    }

    console.log(
      `[asaas/webhook] ✅ ${starsPayment.starsAmount} stars credited to org`,
      starsPayment.organizationId,
    );
  } catch (err) {
    console.error("[asaas/webhook] error processing payment:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

export const runtime = "nodejs";
