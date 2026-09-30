import "server-only";

import { inngest } from "@/inngest/client";

export const JOURNAL_SYNC_EVENT = "accounting/journal.sync";

/**
 * Pede a sincronização contábil de lançamentos. Best-effort e fora da
 * transação do financeiro (regra 18): falhar aqui nunca desfaz o lançamento —
 * o cron noturno reconcilia o que ficar para trás.
 */
export async function queueJournalSync(organizationId: string, entryIds: string[]): Promise<void> {
  if (entryIds.length === 0) return;
  try {
    await inngest.send({ name: JOURNAL_SYNC_EVENT, data: { organizationId, entryIds } });
  } catch (error) {
    console.error("[accounting/journal] falha ao enfileirar sincronização:", error);
  }
}
