import { NonRetriableError } from "inngest";
import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import { getNerpConfig } from "@/app/router/nerp/_helpers";
import { callNerpProcedure } from "@/http/nerp/_call";
import { CATALOG_ORDER_PAID_EVENT } from "@/features/nerp-catalog/lib/confirm-payment";

type CatalogOrderPaidEvent = { orderId: string; organizationId: string };

function toNerpPaymentMethod(method: string | null): "PIX" | "OTHER" {
  return method === "PIX" ? "PIX" : "OTHER";
}

// Pago no Órbita → venda do catálogo vira CONFIRMED no NERP (baixa de estoque,
// financeiro e ERP ficam de lá).
export const syncCatalogOrderToNerp = inngest.createFunction(
  {
    id: "nerp-catalog-sync-order-paid",
    retries: 5,
    concurrency: { limit: 1, key: "event.data.orderId" },
  },
  { event: CATALOG_ORDER_PAID_EVENT },
  async ({ event, step }) => {
    const { orderId, organizationId } = event.data as CatalogOrderPaidEvent;

    const order = await step.run("load-order", () =>
      prisma.catalogOrder.findUnique({
        where: { id: orderId },
        select: {
          nerpSaleId: true,
          total: true,
          paidAt: true,
          paymentMethod: true,
          asaasPaymentId: true,
          nerpSyncedAt: true,
        },
      }),
    );
    if (!order) throw new NonRetriableError("catalog_order_not_found");
    if (order.nerpSyncedAt) return { skipped: true };

    await step.run("confirm-sale-on-nerp", async () => {
      const { config } = await getNerpConfig(organizationId);
      await callNerpProcedure(config, "catalogOrder.updateStatus", {
        saleId: order.nerpSaleId,
        status: "CONFIRMED",
        ...(order.asaasPaymentId
          ? {
              payment: {
                method: toNerpPaymentMethod(order.paymentMethod),
                amount: Number(order.total),
                gatewayPaymentId: order.asaasPaymentId,
                paidAt: order.paidAt ?? new Date().toISOString(),
              },
            }
          : {}),
      });
    });

    await step.run("mark-synced", () =>
      prisma.catalogOrder.update({
        where: { id: orderId },
        data: { nerpSyncedAt: new Date() },
      }),
    );
    return { ok: true };
  },
);
