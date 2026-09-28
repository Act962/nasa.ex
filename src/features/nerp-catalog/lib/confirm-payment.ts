import "server-only";
import prisma from "@/lib/prisma";
import { inngest } from "@/inngest/client";
import { moveLeadToStage } from "@/features/leads/lib/move-lead";
import { nerpPublicOrigin } from "@/features/nerp/lib/oauth";
import { buildOrderPortalUrl, formatBrl } from "../utils/format-order";
import { deliverTextToLead } from "./order-channel";
import { awardPurchaseStars } from "@/features/star-friends/lib/earn";
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

// Idempotente: webhook do Asaas, polling do Inngest e a tool do Astro podem
// chegar juntos — só quem vence o updateMany segue com os efeitos.
export async function confirmCatalogOrderPayment(orderId: string, payment: ConfirmedPayment) {
  const paidAt = payment.paidAt ? new Date(payment.paidAt) : new Date();
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

  if (integration) {
    try {
      await moveLeadToStage({
        leadId: order.lead.id,
        toTrackingId: integration.logisticsTrackingId,
        toStatusId: integration.logisticsStatusId,
      });
      await prisma.catalogOrder.update({
        where: { id: order.id },
        data: { status: "IN_LOGISTICS" },
      });
    } catch (error) {
      console.error("[nerp-catalog] move_to_logistics_failed", error);
    }
  }

  if (order.lead.conversation) {
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
