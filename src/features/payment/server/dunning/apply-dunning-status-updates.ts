import "server-only";

import prisma from "@/lib/prisma";
import type { CanonicalInboundStatusUpdate } from "@/features/tracking-chat/lib/providers";

// Confirmações do WhatsApp oficial nos avisos da régua (spec 0115): a Meta aceita a
// mensagem na hora e só depois avisa se entregou, se foi lida ou se falhou. Roda ao
// lado do chat e das campanhas no webhook oficial; um wamid de outra origem não casa
// com nenhum aviso e é ignorado. Idempotente: só preenche o que ainda está vazio.

/** "meta-131026": o código da Meta, traduzido na tela por `describeDunningFailure`. */
function toMetaFailureCode(errorReason: string | undefined): string {
  if (!errorReason) return "meta-failed";
  try {
    const parsed = JSON.parse(errorReason) as { code?: number | string };
    return parsed.code !== undefined ? `meta-${parsed.code}` : "meta-failed";
  } catch {
    return "meta-failed";
  }
}

export async function applyDunningStatusUpdates(
  statusUpdates: ReadonlyArray<CanonicalInboundStatusUpdate> | undefined,
): Promise<{ applied: number }> {
  const relevantUpdates = (statusUpdates ?? []).filter((update) => update.status !== "sent");
  if (relevantUpdates.length === 0) return { applied: 0 };

  const executions = await prisma.paymentDunningExecution.findMany({
    where: { messageId: { in: relevantUpdates.map((update) => update.externalMessageId) } },
    select: { id: true, messageId: true, status: true, deliveredAt: true, readAt: true },
  });
  if (executions.length === 0) return { applied: 0 };

  let applied = 0;
  for (const update of relevantUpdates) {
    const execution = executions.find((candidate) => candidate.messageId === update.externalMessageId);
    if (!execution) continue;

    if (update.status === "delivered" && !execution.deliveredAt) {
      await prisma.paymentDunningExecution.update({
        where: { id: execution.id },
        data: { deliveredAt: update.at },
      });
      execution.deliveredAt = update.at;
      applied += 1;
    } else if (update.status === "read" && !execution.readAt) {
      // "Lido" sem "entregue" antes acontece quando a Meta reordena os webhooks.
      await prisma.paymentDunningExecution.update({
        where: { id: execution.id },
        data: { readAt: update.at, deliveredAt: execution.deliveredAt ?? update.at },
      });
      execution.readAt = update.at;
      applied += 1;
    } else if (update.status === "failed" && !execution.readAt && execution.status !== "FAILED") {
      await prisma.paymentDunningExecution.update({
        where: { id: execution.id },
        data: { status: "FAILED", errorMessage: toMetaFailureCode(update.errorReason) },
      });
      execution.status = "FAILED";
      applied += 1;
    }
  }
  return { applied };
}
