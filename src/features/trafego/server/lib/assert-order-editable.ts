import "server-only";
import prisma from "@/lib/prisma";
import { ORPCError } from "@orpc/server";
import { isOrderEditable } from "@/features/trafego/lib/order-status";

/**
 * Carrega o pedido garantindo que ele é da org do chamador e que ainda aceita
 * edição de materiais. Centraliza a checagem pra nenhuma procedure de escrita
 * esquecer o filtro por organização.
 */
export async function assertOrderEditable(orderId: string, organizationId: string) {
  const order = await prisma.trafegoOrder.findFirst({
    where: { id: orderId, organizationId },
    select: {
      id: true,
      status: true,
      maxCreatives: true,
      maxCopies: true,
      _count: { select: { creatives: true, copies: true } },
    },
  });

  if (!order) {
    throw new ORPCError("NOT_FOUND", { message: "Campanha não encontrada." });
  }
  if (!isOrderEditable(order.status)) {
    throw new ORPCError("BAD_REQUEST", {
      message:
        "Esta campanha já está em análise pela equipe e não aceita mais alterações.",
    });
  }

  return {
    id: order.id,
    status: order.status,
    maxCreatives: order.maxCreatives,
    maxCopies: order.maxCopies,
    creativesCount: order._count.creatives,
    copiesCount: order._count.copies,
  };
}
