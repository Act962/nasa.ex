import "server-only";
import { requestLeadMetricsRecompute } from "@/features/leads/lib/metrics/request-recompute";
import { trackLeadEvent } from "@/lib/lead-journey/track";
import prisma from "@/lib/prisma";
import { inngest } from "@/inngest/client";
import { moveLeadToStage } from "@/features/leads/lib/move-lead";
import { nerpPublicOrigin } from "@/features/nerp/lib/oauth";
import { buildOrderPortalUrl, formatBrl, toLeadAmountCents } from "../utils/format-order";
import { deliverTextToLead } from "./order-channel";
import { awardPurchaseStars } from "@/features/star-friends/lib/earn";
import { isCatalogStageKey } from "./catalog-stages";
import { handleCatalogStageEntry } from "./stage-flow";
import type { CatalogOrderItem } from "../schemas/order-payload";

export const CATALOG_ORDER_PAID_EVENT = "nerp/catalog-order.paid";

export type ConfirmedPayment = {
  asaasPaymentId: string;
  amount: number;
  billingType: string;
  paidAt: string | null;
};

export async function resendNerpSyncIfPending(orderId: string) {
  const order = await prisma.catalogOrder.findUnique({
    where: { id: orderId },
    select: { organizationId: true, status: true, nerpSyncedAt: true },
  });
  const isPaid = order?.status === "PAID" || order?.status === "IN_LOGISTICS";
  if (!order || !isPaid || order.nerpSyncedAt) return;
  await inngest.send({
    name: CATALOG_ORDER_PAID_EVENT,
    data: { orderId, organizationId: order.organizationId },
  });
}

async function closeOrderLeadAsWon(leadId: string, saleNumber: number) {
  const notes = `Pedido #${saleNumber} pago; o atendimento seguiu no lead do cliente na logística.`;
  await prisma.leadHistory.create({ data: { leadId, action: "WON", notes } });
  await prisma.lead.update({
    where: { id: leadId },
    data: { currentAction: "WON", closedAt: new Date(), statusFlow: "FINISHED" },
  });
  await trackLeadEvent({ leadId, kind: "won", metadata: { source: "catalog_order_paid", notes } });
}

// Idempotente: webhook do Asaas, polling do Inngest e a tool do Astro podem
// chegar juntos — só quem vence o updateMany segue com os efeitos.
export async function confirmCatalogOrderPayment(orderId: string, payment: ConfirmedPayment) {
  // Asaas manda só a data ("2026-09-29"): virar meia-noite UTC mostra 21h do dia anterior no Brasil.
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(payment.paidAt ?? "");
  const paidAt = payment.paidAt && !isDateOnly ? new Date(payment.paidAt) : new Date();
  const claim = await prisma.catalogOrder.updateMany({
    where: { id: orderId, status: { in: ["RECEIVED", "NEGOTIATING", "AWAITING_PAYMENT"] } },
    data: { status: "PAID", paidAt, asaasPaymentId: payment.asaasPaymentId },
  });
  if (claim.count === 0) {
    // Reenvio do webhook/polling cobre o caso em que o evento pro NERP falhou
    // depois do claim: sem isso a venda ficaria pendente lá para sempre.
    await resendNerpSyncIfPending(orderId);
    return { alreadyConfirmed: true };
  }

  const order = await prisma.catalogOrder.findUniqueOrThrow({
    where: { id: orderId },
    include: {
      lead: { select: { id: true, trackingId: true, conversation: { select: { id: true } } } },
    },
  });
  // Pedido pago conta como compra na Visão do Lead (spec 0085). Best-effort.
  await requestLeadMetricsRecompute(order.lead.id);
  const integration = await prisma.nerpCatalogIntegration.findUnique({
    where: { organizationId: order.organizationId },
    select: { logisticsTrackingId: true, logisticsStatusId: true },
  });

  try {
    await prisma.paymentEntry.create({
      data: {
        organizationId: order.organizationId,
        type: "RECEIVABLE",
        status: "PAID",
        description: `Pedido #${order.nerpSaleNumber} — Catálogo online`,
        amount: Math.round(payment.amount * 100),
        paidAmount: Math.round(payment.amount * 100),
        dueDate: paidAt,
        paidAt,
        documentNumber: payment.asaasPaymentId,
        notes: `Pago via Asaas (${payment.billingType})`,
        trackingId: order.lead.trackingId,
        leadId: order.lead.id,
      },
    });
  } catch (error) {
    console.error("[nerp-catalog] payment_entry_failed", error);
  }

  try {
    await awardPurchaseStars({
      organizationId: order.organizationId,
      source: "CATALOG_ORDER",
      sourceId: order.id,
      leadId: order.lead.id,
      amount: payment.amount,
      items: (order.items as CatalogOrderItem[]).map((item) => ({
        name: item.name,
        quantity: item.quantity,
        total: item.total,
      })),
      purchaseLabel: `Pedido #${order.nerpSaleNumber} — Catálogo online`,
    });
  } catch (error) {
    console.error("[nerp-catalog] star_friends_award_failed", error);
  }

  let isStageFlowActive = false;
  if (integration) {
    try {
      const moved = await moveLeadToStage({
        leadId: order.lead.id,
        toTrackingId: integration.logisticsTrackingId,
        toStatusId: integration.logisticsStatusId,
      });
      // Cliente recorrente: o lead que já estava na logística é que avança. O do pedido
      // sai de "Novos pedidos" como ganho, em vez de ficar parado no funil de vendas.
      if (moved.mergedIntoExistingLead) {
        // O lead reaproveitado guarda o valor do pedido anterior; o card da logística mostra o pedido atual.
        await prisma.lead
          .update({ where: { id: moved.leadId }, data: { amount: toLeadAmountCents(Number(order.total)) } })
          .catch((error) => console.error("[nerp-catalog] update_logistics_amount_failed", error));
        await closeOrderLeadAsWon(order.lead.id, order.nerpSaleNumber).catch((error) =>
          console.error("[nerp-catalog] close_order_lead_failed", error),
        );
      }
      const targetStatus = await prisma.status.findUnique({ where: { id: moved.statusId }, select: { systemKey: true } });
      isStageFlowActive = isCatalogStageKey(targetStatus?.systemKey);
      if (!isStageFlowActive) {
        await prisma.catalogOrder.update({
          where: { id: order.id },
          data: { status: "IN_LOGISTICS" },
        });
      } else if (!moved.hasStatusChanged) {
        // Já estava em "Pagamento confirmado": nenhum evento de mudança sai, então os avisos partem daqui.
        await handleCatalogStageEntry({ leadId: moved.leadId, statusId: moved.statusId });
      }
    } catch (error) {
      console.error("[nerp-catalog] move_to_logistics_failed", error);
    }
  }

  // Com as etapas padrão (spec 0044) os avisos saem pelo stage-flow; esta mensagem é do fluxo antigo.
  if (order.lead.conversation && !isStageFlowActive) {
    const portalUrl = buildOrderPortalUrl(nerpPublicOrigin(), order.publicToken);
    await deliverTextToLead({
      conversationId: order.lead.conversation.id,
      senderName: "Astro",
      text: `✅ Pagamento de ${formatBrl(payment.amount)} confirmado! Seu pedido #${order.nerpSaleNumber} já foi para a separação e entrega. Acompanhe por aqui: ${portalUrl}`,
      metadata: { kind: "catalog_order_paid", catalogOrderId: order.id },
    }).catch((error) => console.error("[nerp-catalog] paid_message_failed", error));
  }

  await inngest.send({
    name: CATALOG_ORDER_PAID_EVENT,
    data: { orderId: order.id, organizationId: order.organizationId },
  });

  return { alreadyConfirmed: false };
}
