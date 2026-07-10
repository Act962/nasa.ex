import "server-only";
import prisma from "@/lib/prisma";
import { BroadcastRecipientStatus } from "@/generated/prisma/enums";
import type { CanonicalInboundStatusUpdate } from "@/features/tracking-chat/lib/providers";
import { recomputeBroadcastCounters } from "./broadcast-counters";

/**
 * Casa os `statusUpdates` da Meta (sent/delivered/read/failed) com os
 * `BroadcastRecipient` pelo `externalMessageId` (wamid) e avança o status +
 * timestamps, recomputando os contadores dos broadcasts afetados.
 *
 * Roda lado a lado com `applyStatusUpdates` (que cuida do `Message` do chat) no
 * webhook oficial. Um wamid pertence OU a um chat OU a um disparo, então cada
 * função ignora o que não é seu.
 *
 * Idempotente: progressão sem downgrade (a Meta reordena/reentrega webhooks).
 */

const PROGRESSION: Record<string, number> = {
  PENDING: 0,
  QUEUED: 1,
  SENT: 2,
  DELIVERED: 3,
  READ: 4,
};

function mapStatus(
  status: CanonicalInboundStatusUpdate["status"],
): BroadcastRecipientStatus {
  switch (status) {
    case "delivered":
      return BroadcastRecipientStatus.DELIVERED;
    case "read":
      return BroadcastRecipientStatus.READ;
    case "failed":
      return BroadcastRecipientStatus.FAILED;
    case "sent":
    default:
      return BroadcastRecipientStatus.SENT;
  }
}

export async function applyBroadcastStatusUpdates(
  statusUpdates: ReadonlyArray<CanonicalInboundStatusUpdate> | undefined,
): Promise<{ applied: number }> {
  if (!statusUpdates || statusUpdates.length === 0) return { applied: 0 };

  const affectedBroadcastIds = new Set<string>();
  let applied = 0;

  for (const update of statusUpdates) {
    const nextStatus = mapStatus(update.status);
    try {
      const recipient = await prisma.broadcastRecipient.findFirst({
        where: { externalMessageId: update.externalMessageId },
        select: { id: true, status: true, broadcastId: true },
      });
      // wamid de uma mensagem de chat (não de disparo) → não é nosso.
      if (!recipient) continue;

      if (nextStatus === BroadcastRecipientStatus.FAILED) {
        if (recipient.status === BroadcastRecipientStatus.READ) continue;
      } else {
        const current = PROGRESSION[recipient.status] ?? 0;
        const next = PROGRESSION[nextStatus] ?? 0;
        if (next <= current) continue;
      }

      await prisma.broadcastRecipient.update({
        where: { id: recipient.id },
        data: {
          status: nextStatus,
          ...(nextStatus === BroadcastRecipientStatus.DELIVERED
            ? { deliveredAt: update.at }
            : {}),
          ...(nextStatus === BroadcastRecipientStatus.READ
            ? { readAt: update.at }
            : {}),
          ...(nextStatus === BroadcastRecipientStatus.FAILED
            ? {
                errorCode: "DELIVERY_FAILED",
                errorMessage: update.errorReason ?? null,
              }
            : {}),
        },
      });
      affectedBroadcastIds.add(recipient.broadcastId);
      applied += 1;
    } catch (error) {
      console.error("[apply-broadcast-status-updates] failed", {
        externalMessageId: update.externalMessageId,
        status: update.status,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  for (const broadcastId of affectedBroadcastIds) {
    await recomputeBroadcastCounters(broadcastId).catch(() => {});
  }

  return { applied };
}
