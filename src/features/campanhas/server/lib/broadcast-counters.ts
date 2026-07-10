import "server-only";
import prisma from "@/lib/prisma";

/**
 * Recalcula os contadores denormalizados de um broadcast a partir do estado
 * real dos destinatários. Recompute (não incremento) → idempotente, sem drift
 * em retries de disparo ou reentrega de webhooks de status.
 *
 * Semântica monotônica (READ implica DELIVERED implica SENT):
 *  - sentCount      = SENT | DELIVERED | READ
 *  - deliveredCount = DELIVERED | READ
 *  - readCount      = READ
 *  - failedCount    = FAILED
 */
export async function recomputeBroadcastCounters(
  broadcastId: string,
): Promise<void> {
  const [sent, delivered, read, failed] = await Promise.all([
    prisma.broadcastRecipient.count({
      where: { broadcastId, status: { in: ["SENT", "DELIVERED", "READ"] } },
    }),
    prisma.broadcastRecipient.count({
      where: { broadcastId, status: { in: ["DELIVERED", "READ"] } },
    }),
    prisma.broadcastRecipient.count({
      where: { broadcastId, status: "READ" },
    }),
    prisma.broadcastRecipient.count({
      where: { broadcastId, status: "FAILED" },
    }),
  ]);

  await prisma.broadcast.update({
    where: { id: broadcastId },
    data: {
      sentCount: sent,
      deliveredCount: delivered,
      readCount: read,
      failedCount: failed,
    },
  });
}
