import "server-only";
import prisma from "@/lib/prisma";
import { pusherServer } from "@/lib/pusher";
import { MessageStatus } from "@/generated/prisma/enums";
import type { CanonicalInboundStatusUpdate } from "../providers";

/**
 * Persiste os `statusUpdates` da Meta (sent/delivered/read/failed) no
 * `Message.status` e notifica o chat via pusher `message:updated` (Fase 9 —
 * followup #4).
 *
 * Idempotente: a Meta reentrega webhooks em qualquer 5xx, então um mesmo
 * status pode chegar N vezes. Lookup por `Message.messageId` (`@unique`, é o
 * `wamid` da Meta) — re-entrega vira no-op.
 *
 * **Nunca rebaixa**: a Meta pode entregar `delivered` depois de `read` por
 * reordenação de webhooks. Usamos um ranking de progressão pra só avançar.
 * `FAILED` é aplicado só se a mensagem ainda não foi lida/apagada.
 */

const PROGRESSION: Record<string, number> = {
  PENDING: 0,
  SENT: 1,
  DELIVERED: 2,
  SEEN: 3,
};

function mapStatus(status: CanonicalInboundStatusUpdate["status"]): MessageStatus {
  switch (status) {
    case "delivered":
      return MessageStatus.DELIVERED;
    case "read":
      return MessageStatus.SEEN;
    case "failed":
      return MessageStatus.FAILED;
    case "sent":
    default:
      return MessageStatus.SENT;
  }
}

export async function applyStatusUpdates(
  statusUpdates: ReadonlyArray<CanonicalInboundStatusUpdate> | undefined,
): Promise<{ applied: number }> {
  if (!statusUpdates || statusUpdates.length === 0) return { applied: 0 };

  let applied = 0;
  for (const update of statusUpdates) {
    const nextStatus = mapStatus(update.status);
    try {
      const message = await prisma.message.findUnique({
        where: { messageId: update.externalMessageId },
        select: { id: true, conversationId: true, status: true, seen: true },
      });
      // Mensagem outbound pode não estar no nosso banco ainda (race) ou ser
      // de antes da importação — skip silencioso.
      if (!message) continue;
      if (message.status === MessageStatus.DELETED) continue;

      if (nextStatus === MessageStatus.FAILED) {
        if (message.status === MessageStatus.SEEN) continue;
      } else {
        const current = PROGRESSION[message.status] ?? 0;
        const next = PROGRESSION[nextStatus] ?? 0;
        if (next <= current) continue;
      }

      const updated = await prisma.message.update({
        where: { id: message.id },
        data: {
          status: nextStatus,
          ...(nextStatus === MessageStatus.SEEN ? { seen: true } : {}),
        },
        select: { id: true, conversationId: true, status: true },
      });
      applied += 1;

      await pusherServer.trigger(updated.conversationId, "message:updated", {
        messageId: updated.id,
        conversationId: updated.conversationId,
        status: updated.status,
      });
    } catch (error) {
      console.error("[apply-status-updates] failed", {
        externalMessageId: update.externalMessageId,
        status: update.status,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { applied };
}
