/**
 * POST /api/payments/asaas/webhook
 *
 * Recebe notificações de pagamento da Asaas e credita Stars ao usuário.
 *
 * Configurar no painel Asaas:
 *   Configurações → Notificações (Webhooks) → Adicionar URL:
 *   https://seudominio.com/api/payments/asaas/webhook
 *   Token de autenticação: o mesmo valor salvo em /admin/payments (webhookSecret)
 *   Eventos: PAYMENT_RECEIVED, PAYMENT_CONFIRMED
 *
 * Fail-closed: sem `asaas-access-token` igual ao `webhookSecret` de um gateway
 * Asaas ativo, recusa (o handler credita Stars). `ASAAS_STARS_WEBHOOK_AUTH_MODE=log-only`
 * registra o que seria recusado sem recusar — só para a implantação.
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { purchaseTopUp } from "@/features/stars/lib/star-service";
import { processPaymentPartnerEffects } from "@/features/partner/lib/partner-service";
import {
  isAsaasStarsWebhookAuthorized,
  isPaidValueSufficient,
} from "@/features/stars/lib/asaas-webhook-guard";
import { resolveWebhookAuthMode } from "@/lib/security/webhook-auth";

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
  const authMode = resolveWebhookAuthMode(process.env.ASAAS_STARS_WEBHOOK_AUTH_MODE, "enforce");
  const receivedToken = req.headers.get("asaas-access-token");
  const asaasGateways = await prisma.paymentGatewayConfig.findMany({
    where: { provider: "asaas", isActive: true },
    select: { webhookSecret: true },
  });
  const isAuthorized = isAsaasStarsWebhookAuthorized(
    receivedToken,
    asaasGateways.map((gateway) => gateway.webhookSecret),
  );

  if (!isAuthorized) {
    console.warn(
      `[asaas/webhook] token inválido (header ${receivedToken ? "presente" : "ausente"}, ` +
        `${asaasGateways.filter((gateway) => gateway.webhookSecret).length} gateway(s) com segredo, modo ${authMode})`,
    );
    if (authMode === "enforce") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

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

    if (!isPaidValueSufficient(payment.value, Number(starsPayment.amountBrl))) {
      console.error(
        `[asaas/webhook] valor pago (${payment.value}) menor que o esperado (${starsPayment.amountBrl}) em`,
        paymentId,
        `modo ${authMode}`,
      );
      if (authMode === "enforce") {
        return NextResponse.json({ received: true, skipped: "value_mismatch" });
      }
    }

    // Marca como pago de forma atômica: duas entregas simultâneas do mesmo
    // evento não podem creditar duas vezes.
    const claimed = await prisma.starsPayment.updateMany({
      where: { id: paymentId, status: { not: "paid" } },
      data:  { status: "paid", externalId: payment.id },
    });
    if (claimed.count === 0) {
      return NextResponse.json({ received: true, alreadyProcessed: true });
    }

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
    // Best-effort. Asaas StarsPayment não tem leadId direto — quem usar
    // o trigger pra um lead específico deve referenciar via metadata na
    // hora da criação do charge (futuro).
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
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

export const runtime = "nodejs";
