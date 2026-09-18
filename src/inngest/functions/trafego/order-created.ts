import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import { ensureTrafegoLeadForOrder } from "@/features/trafego/server/lib/ensure-trafego-lead";
import { loadTrafegoSettings } from "@/features/trafego/server/lib/trafego-settings";
import { recordTrafegoSystemMessage } from "@/features/trafego/server/lib/conversation-bridge";

/** Prepara a Conversation do tracking para que um pedido nunca abra em branco. */
export const trafegoOrderCreated = inngest.createFunction(
  { id: "trafego-order-created", retries: 3, idempotency: "event.data.orderId" },
  { event: "trafego/order.created" },
  async ({ event, step }) => {
    const { orderId } = event.data as { orderId: string };
    const leadId = await step.run("ensure-lead", () => ensureTrafegoLeadForOrder(orderId));
    if (!leadId) return { ok: false, reason: "lead_unavailable", orderId };

    const result = await step.run("record-system-message", async () => {
      const [order, settings] = await Promise.all([
        prisma.trafegoOrder.findUnique({
          where: { id: orderId },
          select: {
            code: true,
            whatsappNumber: true,
            pendingPurchase: { select: { phone: true } },
            owner: { select: { phone: true } },
          },
        }),
        loadTrafegoSettings(),
      ]);
      if (!order || !settings.operationsTrackingId) return null;
      return recordTrafegoSystemMessage({
        leadId,
        trackingId: settings.operationsTrackingId,
        phone: order.pendingPurchase?.phone ?? order.owner.phone ?? order.whatsappNumber,
        body: `Pedido ${order.code} criado — nossa equipe já está de olho. Escreva por aqui se tiver dúvida.`,
      });
    });
    return { ok: Boolean(result), orderId, leadId };
  },
);
