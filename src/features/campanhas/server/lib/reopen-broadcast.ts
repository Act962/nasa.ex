import "server-only";
import prisma from "@/lib/prisma";
import { recomputeBroadcastCounters } from "./broadcast-counters";

/**
 * Reabre uma campanha `FAILED` para edição/redisparo: os destinatários que
 * falharam voltam a `PENDING` e a campanha volta a `DRAFT` (zera
 * `startedAt`/`completedAt`). Idempotente via recompute dos contadores.
 *
 * `errorCode`/`errorMessage` são PRESERVADOS de propósito — são o "por que
 * falhou" do último disparo, que o operador precisa ver pra corrigir antes de
 * redisparar. O próximo envio sobrescreve (limpa no sucesso, atualiza na falha).
 */
export async function reopenBroadcast(broadcastId: string): Promise<void> {
  await prisma.broadcastRecipient.updateMany({
    where: { broadcastId, status: "FAILED" },
    data: {
      status: "PENDING",
      externalMessageId: null,
    },
  });

  await prisma.broadcast.update({
    where: { id: broadcastId },
    data: { status: "DRAFT", startedAt: null, completedAt: null },
  });

  await recomputeBroadcastCounters(broadcastId);
}
