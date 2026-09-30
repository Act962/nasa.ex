import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import { JOURNAL_SYNC_EVENT } from "@/features/accounting/server/journal/queue-journal-sync";
import { syncAllEntryJournals, syncEntryJournals } from "@/features/accounting/server/journal/sync-entry-journals";
import { syncFiscalObligations } from "@/features/accounting/server/obligations/sync-fiscal-obligations";
import { snapshotRegularityScore } from "@/features/accounting/server/compliance/load-regularity";
import { refreshCreditStatuses } from "@/features/accounting/server/credits/refresh-credit-statuses";

export const JOURNAL_BACKFILL_EVENT = "accounting/journal.backfill";

// Sincronização contábil de lançamentos alterados (spec 0051, D-2).
export const accountingJournalSync = inngest.createFunction(
  { id: "accounting-journal-sync", retries: 3, concurrency: { key: "event.data.organizationId", limit: 1 } },
  { event: JOURNAL_SYNC_EVENT },
  async ({ event, step }) => {
    const { organizationId, entryIds } = event.data as { organizationId: string; entryIds: string[] };
    const journalResult = await step.run("sync-journals", () => syncEntryJournals({ organizationId, entryIds }));
    await step.run("refresh-credit-statuses", () => refreshCreditStatuses(organizationId, entryIds));
    return journalResult;
  },
);

// Reprocessa todos os lançamentos da org (ativação da aba e botão "Reprocessar").
export const accountingJournalBackfill = inngest.createFunction(
  { id: "accounting-journal-backfill", retries: 2, concurrency: { key: "event.data.organizationId", limit: 1 } },
  { event: JOURNAL_BACKFILL_EVENT },
  async ({ event, step }) => {
    const { organizationId } = event.data as { organizationId: string };
    return step.run("sync-all-journals", () => syncAllEntryJournals(organizationId));
  },
);

// Noturno: reconcilia o que escapou (lançamentos criados por outros módulos),
// atualiza o calendário fiscal e grava o snapshot do score de regularidade.
export const accountingNightly = inngest.createFunction(
  { id: "accounting-nightly", retries: 1 },
  { cron: "TZ=America/Sao_Paulo 30 3 * * *" },
  async ({ step }) => {
    const profiles = await step.run("list-orgs", () =>
      prisma.organizationTaxProfile.findMany({ select: { organizationId: true } }),
    );
    const since = new Date(Date.now() - 26 * 60 * 60 * 1000);

    for (const { organizationId } of profiles) {
      await step.run(`reconcile-${organizationId}`, async () => {
        const changed = await prisma.paymentEntry.findMany({
          where: { organizationId, updatedAt: { gte: since } },
          select: { id: true },
        });
        await syncEntryJournals({ organizationId, entryIds: changed.map((entry) => entry.id) });
        await syncFiscalObligations(organizationId);
        await refreshCreditStatuses(organizationId);
        const score = await snapshotRegularityScore(organizationId);
        return { changed: changed.length, scoreBps: score.scoreBps };
      });
    }
    return { organizations: profiles.length };
  },
);
