/**
 * Handler agnóstico de framework do webhook da Asaas (crédito de Stars).
 * A Asaas NÃO assina o corpo — recebemos o corpo cru, parseamos aqui e
 * devolvemos `{ status, body }`. Compartilhado entre o route Next (apps/web)
 * e a rota Fastify (apps/api).
 */
import prisma from "@/lib/prisma";
import { purchaseTopUp } from "@/features/stars/lib/star-service";
import { processPaymentPartnerEffects } from "@/features/partner/lib/partner-service";

interface AsaasWebhookPayload {
  event: string; // "PAYMENT_RECEIVED" | "PAYMENT_CONFIRMED" | etc.
  payment: {
    id: string;
    status: string;
    value: number;
    externalReference: string | null;
  };
}

export type WebhookResult = { status: number; body: unknown };

export async function handleAsaasWebhook(rawBody: string): Promise<WebhookResult> {
  let payload: AsaasWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as AsaasWebhookPayload;
  } catch {
    return { status: 400, body: { error: "Invalid JSON" } };
  }

  const { event, payment } = payload;

  // Only process confirmed payments
  if (event !== "PAYMENT_RECEIVED" && event !== "PAYMENT_CONFIRMED") {
    return { status: 200, body: { received: true, skipped: true } };
  }

  const paymentId = payment.externalReference;
  if (!paymentId) {
    console.warn("[asaas/webhook] no externalReference in payment", payment.id);
    return { status: 200, body: { received: true } };
  }

  try {
    const starsPayment = await prisma.starsPayment.findUnique({
      where: { id: paymentId },
    });

    if (!starsPayment) {
      console.warn("[asaas/webhook] StarsPayment not found:", paymentId);
      return { status: 200, body: { received: true } };
    }

    // Idempotency: skip if already processed
    if (starsPayment.status === "paid") {
      return { status: 200, body: { received: true, alreadyProcessed: true } };
    }

    // Asaas só lida com top-up por pacote (createGatewayCheckout sempre seta
    // packageId). Compra com quantidade customizada (packageId null) é Stripe-only.
    if (!starsPayment.packageId) {
      console.warn(
        "[asaas/webhook] StarsPayment sem packageId — fora do fluxo Asaas:",
        paymentId,
      );
      return { status: 200, body: { received: true } };
    }

    // Mark as paid
    await prisma.starsPayment.update({
      where: { id: paymentId },
      data: { status: "paid", externalId: payment.id },
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

    // ── Modo Agente IA: dispara workflows com PAYMENT_RECEIVED ─────────
    try {
      const { dispatchPaymentReceived } = await import(
        "@/features/workflows/lib/agent-trigger-helpers"
      );
      await dispatchPaymentReceived({
        provider: "ASAAS",
        externalId: payment.id,
        organizationId: starsPayment.organizationId,
        amount: Number(starsPayment.amountBrl) * 100,
      });
    } catch (err) {
      console.error("[asaas/webhook] agent dispatch failed", err);
    }
  } catch (err) {
    console.error("[asaas/webhook] error processing payment:", err);
    return { status: 500, body: { error: "Internal error" } };
  }

  return { status: 200, body: { received: true } };
}
