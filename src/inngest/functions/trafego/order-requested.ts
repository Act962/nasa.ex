import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import { PLATFORM_SHORT_LABEL } from "@/features/trafego/lib/catalog-labels";

/**
 * Dispara quando o cliente ativa a campanha. Avisa a equipe — não publica nada
 * no Meta nem cria Broadcast (spec 0008 §2, não-objetivos).
 *
 * Evento: `trafego/order.requested` — emitido em `beginTrafegoActivation`.
 */
export const trafegoOrderRequested = inngest.createFunction(
  { id: "trafego-order-requested", retries: 3 },
  { event: "trafego/order.requested" },
  async ({ event, step }) => {
    const { orderId } = event.data as { orderId: string };

    const order = await step.run("load-order", async () =>
      prisma.trafegoOrder.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          code: true,
          platform: true,
          planNameSnapshot: true,
          businessName: true,
          assignedToUserId: true,
          organization: { select: { name: true } },
          _count: { select: { creatives: true, copies: true } },
        },
      }),
    );
    if (!order) return { skipped: "order_not_found", orderId };

    const platformLabel = PLATFORM_SHORT_LABEL[order.platform];
    const clientName = order.businessName ?? order.organization.name;

    await step.run("notify-team", async () => {
      const recipients = order.assignedToUserId
        ? [{ id: order.assignedToUserId }]
        : await prisma.user.findMany({
            where: { isSystemAdmin: true, isActive: true },
            select: { id: true },
          });

      if (recipients.length === 0) return;

      await prisma.userNotification.createMany({
        data: recipients.map((recipient) => ({
          userId: recipient.id,
          type: "CUSTOM",
          title: `trafeGO ${order.code} pronto para execução`,
          body: `${clientName} enviou ${order._count.creatives} criativo(s) e ${order._count.copies} copy(ies) — ${platformLabel} · ${order.planNameSnapshot}`,
          appKey: "trafego",
          actionUrl: `/admin/trafego/${order.id}`,
        })),
      });
    });

    return { notified: true, orderId };
  },
);
