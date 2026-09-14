import "server-only";
import { inngest } from "@/inngest/client";
import { ACTIVATABLE_ORDER_STATUSES } from "@/features/trafego/lib/order-status";
import { transitionTrafegoOrder } from "./transition-order";

/**
 * Transição atômica para `REQUESTED` + enfileiramento do aviso à equipe.
 *
 * `expectedFrom` reivindica o pedido só se ele ainda estiver num status
 * ativável — evita duplo disparo por clique duplo, duas abas ou retry do
 * client. Mesmo padrão de `beginBroadcastDispatch`.
 *
 * Retorna se ESTA chamada reivindicou o pedido (e, portanto, enfileirou).
 */
export async function beginTrafegoActivation(params: {
  orderId: string;
  organizationId: string;
  actorUserId: string;
}): Promise<boolean> {
  const { orderId, organizationId, actorUserId } = params;

  const result = await transitionTrafegoOrder({
    orderId,
    organizationId,
    toStatus: "REQUESTED",
    source: "CLIENT",
    actorUserId,
    expectedFrom: ACTIVATABLE_ORDER_STATUSES,
    title: "Campanha enviada para a equipe",
    clientNote:
      "Recebemos seus materiais. Nossa equipe vai revisar e colocar a campanha no ar.",
  });
  if (!result.changed) return false;

  await inngest.send({
    name: "trafego/order.requested",
    data: { orderId, organizationId },
  });

  return true;
}
