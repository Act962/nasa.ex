import "server-only";
import prisma from "@/lib/prisma";

/**
 * Avisos para a equipe sobre o que nenhum fluxo automático resolve sozinho
 * (cobrança duplicada, estorno parcial, disputa, cupom que atingiu a verba).
 */
export async function notifyTrafegoAdmins(params: {
  title: string;
  body: string;
  actionUrl?: string;
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
      actionUrl: params.actionUrl ?? "/admin/trafego",
    })),
  });
  return { notified: admins.length };
}

/** Registro na timeline do pedido que só a equipe vê; o status não muda. */
export async function recordTrafegoInternalEvent(params: {
  orderId: string;
  title: string;
  detail: string;
}): Promise<void> {
  const order = await prisma.trafegoOrder.findUnique({
    where: { id: params.orderId },
    select: { status: true },
  });
  if (!order) return;

  await prisma.trafegoOrderEvent.create({
    data: {
      orderId: params.orderId,
      fromStatus: order.status,
      toStatus: order.status,
      title: params.title,
      detail: params.detail,
      isClientVisible: false,
      source: "SYSTEM",
    },
  });
}
