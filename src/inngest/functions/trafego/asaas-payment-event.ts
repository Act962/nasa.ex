import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import { getPayment } from "@/lib/asaas";
import { loadTrafegoAsaasGateway } from "@/features/trafego/server/lib/asaas-gateway";
import { ASAAS_PAID_STATUSES } from "@/features/trafego/server/lib/asaas-events";
import { markTrafegoPurchasePaid } from "@/features/trafego/server/lib/mark-purchase-paid";
import { formatBrlFromCents } from "@/features/trafego/lib/pricing";

/**
 * Processa um evento de cobrança do Asaas, fora do ciclo do webhook.
 *
 * O webhook só valida o token e enfileira; todo o trabalho é aqui, porque a
 * fila do Asaas é interrompida após 15 falhas seguidas e nada do que acontece
 * abaixo pode segurar a resposta HTTP.
 *
 * O valor NUNCA vem do corpo do evento: a cobrança é relida na API, e é esse
 * valor que decide se houve divergência. Validar o token prova quem mandou;
 * reler a cobrança prova quanto.
 *
 * Evento: `trafego/asaas.payment_event` — emitido em
 * `/api/trafego/asaas/webhook`.
 */
export const trafegoAsaasPaymentEvent = inngest.createFunction(
  { id: "trafego-asaas-payment-event", retries: 3 },
  { event: "trafego/asaas.payment_event" },
  async ({ event, step }) => {
    const { event: asaasEvent, paymentId } = event.data as {
      eventId: string | null;
      event: string;
      paymentId: string;
    };

    const gateway = await step.run("load-gateway", () =>
      loadTrafegoAsaasGateway(),
    );
    if (!gateway) {
      console.warn("[trafego/asaas] gateway desativado — evento descartado");
      return { skipped: "gateway_inactive" as const };
    }

    const payment = await step.run("reload-payment", () =>
      getPayment(gateway.secretKey, gateway.environment, paymentId),
    );

    const pending = await step.run("find-pending", async () => {
      const byChargeId = await prisma.trafegoPendingPurchase.findUnique({
        where: { asaasPaymentId: paymentId },
        select: { id: true, amountBrlCents: true, email: true },
      });
      if (byChargeId) return byChargeId;

      // Cobrança criada mas o vínculo não gravou (falha entre o POST e o
      // update). O `externalReference` é a segunda âncora.
      if (!payment.externalReference) return null;
      return prisma.trafegoPendingPurchase.findUnique({
        where: { id: payment.externalReference },
        select: { id: true, amountBrlCents: true, email: true },
      });
    });

    if (!pending) {
      console.warn(
        `[trafego/asaas] ${paymentId} não pertence a nenhuma pendência — ignorado`,
      );
      return { skipped: "unknown_payment" as const };
    }

    const receivedBrlCents = Math.round(payment.value * 100);

    if (asaasEvent === "PAYMENT_RECEIVED" || asaasEvent === "PAYMENT_CONFIRMED") {
      // O evento diz que algo aconteceu; quem diz se o dinheiro está com a
      // gente é o status atual da cobrança.
      if (!(ASAAS_PAID_STATUSES as readonly string[]).includes(payment.status)) {
        console.warn(
          `[trafego/asaas] ${paymentId}: evento ${asaasEvent} mas status=${payment.status} — sem confirmar`,
        );
        return { skipped: "status_not_paid" as const, status: payment.status };
      }

      const result = await step.run("mark-paid", () =>
        markTrafegoPurchasePaid({
          pendingId: pending.id,
          paymentSource: "pix",
          amountTotalCents: receivedBrlCents,
          pix: {
            confirmedByUserId: null,
            note: `Confirmado automaticamente pelo Asaas (${paymentId}).`,
          },
          claimFromStatuses: ["PENDING", "EXPIRED"],
        }),
      );

      return { status: result.status, pendingId: pending.id };
    }

    if (asaasEvent === "PAYMENT_OVERDUE") {
      const expired = await step.run("expire-pending", () =>
        prisma.trafegoPendingPurchase.updateMany({
          where: { id: pending.id, status: "PENDING" },
          data: { status: "EXPIRED" },
        }),
      );
      return { expired: expired.count };
    }

    if (asaasEvent === "PAYMENT_DELETED") {
      const cancelled = await step.run("cancel-pending", () =>
        prisma.trafegoPendingPurchase.updateMany({
          where: { id: pending.id, status: { in: ["PENDING", "EXPIRED"] } },
          data: { status: "CANCELLED" },
        }),
      );
      return { cancelled: cancelled.count };
    }

    // Estorno e chargeback: avisamos e paramos por aqui. Reverter receita e
    // repasse sozinho é o P-4/P-5/P-6 do backlog, e reverter errado é pior do
    // que não reverter.
    await step.run("notify-reversal", () =>
      notifyAdmins({
        title: "trafeGO: estorno ou chargeback no PIX",
        body: `A cobrança ${paymentId} de ${pending.email} recebeu ${asaasEvent} (${formatBrlFromCents(receivedBrlCents)}). Confira o pedido e o financeiro à mão.`,
      }),
    );

    return { notified: asaasEvent };
  },
);

async function notifyAdmins(params: {
  title: string;
  body: string;
}): Promise<{ notified: number }> {
  const admins = await prisma.user.findMany({
    where: { isSystemAdmin: true, isActive: true },
    select: { id: true },
  });
  if (admins.length === 0) return { notified: 0 };

  await prisma.userNotification.createMany({
    data: admins.map((admin) => ({
      userId: admin.id,
      type: "CUSTOM" as const,
      title: params.title,
      body: params.body,
      appKey: "trafego",
      actionUrl: "/admin/trafego",
    })),
  });
  return { notified: admins.length };
}
