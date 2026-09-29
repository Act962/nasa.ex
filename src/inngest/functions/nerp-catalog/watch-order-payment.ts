import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import {
  CATALOG_ORDER_PAYMENT_CREATED_EVENT,
  refreshOrderPaymentStatus,
} from "@/features/nerp-catalog/lib/order-payments";
import { CATALOG_ORDER_PAID_EVENT } from "@/features/nerp-catalog/lib/confirm-payment";

type PaymentCreatedEvent = { orderId: string; asaasPaymentId: string };

// Rede de segurança do webhook do Asaas: consulta a cobrança a cada 2 min na
// primeira hora e a cada 15 min até completar 24h.
const FAST_CHECKS = 30;
const SLOW_CHECKS = 92;

export const watchCatalogOrderPayment = inngest.createFunction(
  {
    id: "nerp-catalog-watch-order-payment",
    retries: 1,
    cancelOn: [{ event: CATALOG_ORDER_PAID_EVENT, match: "data.orderId" }],
  },
  { event: CATALOG_ORDER_PAYMENT_CREATED_EVENT },
  async ({ event, step }) => {
    const { orderId, asaasPaymentId } = event.data as PaymentCreatedEvent;

    for (let checkIndex = 0; checkIndex < FAST_CHECKS + SLOW_CHECKS; checkIndex++) {
      await step.sleep(`wait-${checkIndex}`, checkIndex < FAST_CHECKS ? "2m" : "15m");

      const outcome = await step.run(`check-${checkIndex}`, async () => {
        const order = await prisma.catalogOrder.findUnique({
          where: { id: orderId },
          select: { asaasPaymentId: true, status: true },
        });
        // Cobrança substituída (cliente trocou PIX por link) — outro watcher assume.
        if (!order || order.asaasPaymentId !== asaasPaymentId) return "superseded";
        if (order.status === "CANCELED") return "canceled";
        const { isPaid } = await refreshOrderPaymentStatus(orderId);
        return isPaid ? "paid" : "pending";
      });
      if (outcome !== "pending") return { outcome };
    }
    return { outcome: "expired" };
  },
);
