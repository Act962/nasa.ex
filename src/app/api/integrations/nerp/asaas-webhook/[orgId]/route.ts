import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto";
import { ASAAS_PAID_STATUSES } from "@/lib/asaas";
import { parseCatalogOrderReference } from "@/features/nerp-catalog/lib/order-payments";
import { confirmCatalogOrderPayment } from "@/features/nerp-catalog/lib/confirm-payment";

type AsaasWebhookPayload = {
  event?: string;
  payment?: {
    id?: string;
    status?: string;
    value?: number;
    billingType?: string;
    externalReference?: string | null;
    paymentDate?: string | null;
    confirmedDate?: string | null;
  };
};

const PAID_EVENTS = new Set(["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED"]);

function isTokenEqual(expected: string, received: string): boolean {
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);
  return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer);
}

// Webhook criado por API na conta Asaas da loja ao salvar a integração.
// O Asaas manda o authToken no header `asaas-access-token`.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;
  const integration = await prisma.nerpCatalogIntegration.findUnique({
    where: { organizationId: orgId },
    select: { asaasWebhookToken: true },
  });
  const receivedToken = request.headers.get("asaas-access-token");
  if (!integration?.asaasWebhookToken || !receivedToken) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let expectedToken: string;
  try {
    expectedToken = decryptSecret(integration.asaasWebhookToken);
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!isTokenEqual(expectedToken, receivedToken)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as AsaasWebhookPayload | null;
  const payment = payload?.payment;
  const orderId = parseCatalogOrderReference(payment?.externalReference);
  // 200 pra eventos que não são nossos: o Asaas pausa a fila em respostas de erro.
  if (!payload?.event || !payment?.id || !orderId) {
    return NextResponse.json({ received: true });
  }

  const isPaid =
    PAID_EVENTS.has(payload.event) && ASAAS_PAID_STATUSES.has(payment.status ?? "");
  if (!isPaid) return NextResponse.json({ received: true });

  const order = await prisma.catalogOrder.findFirst({
    where: { id: orderId, organizationId: orgId },
    select: { id: true },
  });
  if (!order) return NextResponse.json({ received: true });

  try {
    await confirmCatalogOrderPayment(order.id, {
      asaasPaymentId: payment.id,
      amount: payment.value ?? 0,
      billingType: payment.billingType ?? "UNKNOWN",
      paidAt: payment.confirmedDate ?? payment.paymentDate ?? null,
    });
  } catch (error) {
    console.error("[nerp/asaas-webhook] confirm_failed", error);
    return NextResponse.json({ error: "confirm_failed" }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
