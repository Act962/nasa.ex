import "server-only";
import prisma from "@/lib/prisma";
import { inngest } from "@/inngest/client";
import type { BroadcastStatus } from "@/generated/prisma/enums";

/**
 * Transição atômica pra `SENDING` + enfileiramento do disparo em massa. O
 * `updateMany` com guarda de status reivindica a campanha só se ela ainda
 * estiver num dos `fromStatuses` — evita disparo duplo (duas execuções do cron,
 * ou cron + clique manual concorrentes). Retorna se esta chamada reivindicou a
 * campanha (e, portanto, enfileirou o evento).
 */
export async function beginBroadcastDispatch(params: {
  broadcastId: string;
  organizationId: string;
  fromStatuses: BroadcastStatus[];
}): Promise<boolean> {
  const { broadcastId, organizationId, fromStatuses } = params;

  const current = await prisma.broadcast.findFirst({
    where: { id: broadcastId, organizationId, status: { in: fromStatuses } },
    select: { status: true, startedAt: true },
  });
  if (!current) return false;

  const claimed = await prisma.broadcast.updateMany({
    where: { id: broadcastId, organizationId, status: current.status },
    data: { status: "SENDING", startedAt: new Date() },
  });
  if (claimed.count === 0) return false;

  try {
    await inngest.send({
      name: "campanhas/broadcast.send",
      data: { broadcastId, organizationId },
    });
  } catch (error) {
    // Sem o evento na fila ninguém envia: devolve a campanha ao status anterior para o cliente tentar de novo.
    await prisma.broadcast.updateMany({
      where: { id: broadcastId, organizationId, status: "SENDING" },
      data: { status: current.status, startedAt: current.startedAt },
    });
    throw error;
  }
  return true;
}
