import "server-only";
import prisma from "@/lib/prisma";
import { inngest } from "@/inngest/client";
import { ACTIVATABLE_ORDER_STATUSES } from "@/features/trafego/lib/order-status";

/**
 * Transição atômica para `REQUESTED` + enfileiramento do aviso à equipe.
 *
 * O `updateMany` com guarda de status reivindica o pedido só se ele ainda
 * estiver num status ativável — evita duplo disparo por clique duplo, duas
 * abas ou retry do client. Mesmo padrão de `beginBroadcastDispatch`.
 *
 * Retorna se ESTA chamada reivindicou o pedido (e, portanto, enfileirou).
 */
export async function beginTrafegoActivation(params: {
  orderId: string;
  organizationId: string;
  actorUserId: string;
}): Promise<boolean> {
  const { orderId, organizationId, actorUserId } = params;

  const claimed = await prisma.trafegoOrder.updateMany({
    where: {
      id: orderId,
      organizationId,
      status: { in: ACTIVATABLE_ORDER_STATUSES },
    },
    data: { status: "REQUESTED", requestedAt: new Date() },
  });
  if (claimed.count === 0) return false;

  await prisma.trafegoOrderEvent.create({
    data: {
      orderId,
      toStatus: "REQUESTED",
      title: "Campanha enviada para a equipe",
      detail:
        "Recebemos seus materiais. Nossa equipe vai revisar e colocar a campanha no ar.",
      actorUserId,
    },
  });

  await inngest.send({
    name: "trafego/order.requested",
    data: { orderId, organizationId },
  });

  return true;
}
