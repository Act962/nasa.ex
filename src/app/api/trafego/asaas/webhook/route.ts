/**
 * POST /api/trafego/asaas/webhook
 *
 * Eventos de cobrança do Asaas para o trafeGO (spec 0020).
 *
 * Endpoint separado do webhook de Stars de propósito: segredo próprio, e o
 * trafeGO não herda o risco do outro domínio.
 *
 * Duas regras que moldam este arquivo:
 *  · O token é validado fail-closed. Sem `authToken` configurado, recusa tudo.
 *  · Fora isso, responde 200 quase sempre. O Asaas interrompe a fila depois de
 *    15 falhas seguidas, então devolver 500 para um evento que não é nosso
 *    derrubaria a confirmação de PIX de todo mundo. A única exceção é falha ao
 *    enfileirar: aí o 500 é desejado, porque queremos a reentrega.
 *
 * Configurar no painel Asaas → Integrações → Webhooks:
 *   URL:    https://<dominio>/api/trafego/asaas/webhook
 *   Token:  o mesmo valor salvo em /admin/payments (webhookSecret)
 *   Eventos: PAYMENT_RECEIVED, PAYMENT_CONFIRMED, PAYMENT_OVERDUE,
 *            PAYMENT_REFUNDED, PAYMENT_PARTIALLY_REFUNDED,
 *            PAYMENT_CHARGEBACK_REQUESTED, PAYMENT_DELETED
 */

import { NextRequest, NextResponse } from "next/server";
import { inngest } from "@/inngest/client";
import {
  isAsaasWebhookTokenValid,
  loadTrafegoAsaasGateway,
} from "@/features/trafego/server/lib/asaas-gateway";
import { isHandledTrafegoAsaasEvent } from "@/features/trafego/server/lib/asaas-events";

interface AsaasWebhookBody {
  id?: string;
  event?: string;
  payment?: { id?: string; externalReference?: string | null };
}

export async function POST(req: NextRequest) {
  const gateway = await loadTrafegoAsaasGateway();
  const receivedToken = req.headers.get("asaas-access-token");

  if (!isAsaasWebhookTokenValid(receivedToken, gateway?.authToken ?? null)) {
    console.warn(
      `[trafego/asaas] token recusado (header ${receivedToken ? "presente" : "ausente"}, gateway ${gateway ? "configurado" : "ausente"})`,
    );
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as AsaasWebhookBody | null;
  const event = body?.event;
  const paymentId = body?.payment?.id;

  if (!event || !paymentId) {
    console.warn("[trafego/asaas] evento sem event/payment.id — ignorado");
    return NextResponse.json({ received: true, skipped: "malformed" });
  }

  if (!isHandledTrafegoAsaasEvent(event)) {
    return NextResponse.json({ received: true, skipped: "unhandled_event" });
  }

  try {
    await inngest.send({
      name: "trafego/asaas.payment_event",
      data: { eventId: body?.id ?? null, event, paymentId },
    });
  } catch (error) {
    // Único 500 aceitável: o evento não foi guardado em lugar nenhum, então
    // precisamos que o Asaas reentregue.
    console.error("[trafego/asaas] dispatch Inngest falhou:", error);
    return NextResponse.json({ error: "Queue unavailable" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

export const runtime = "nodejs";
