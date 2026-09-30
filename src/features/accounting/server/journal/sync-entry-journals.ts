import "server-only";

import prisma from "@/lib/prisma";
import {
  buildEntryJournal,
  isJournalBalanced,
  type JournalEntryDraft,
} from "@/features/accounting/lib/journal/build-entry-journal";
import {
  loadAccountMappings,
  loadSystemAccounts,
  type EntryAccountMappings,
  type SystemAccountMap,
} from "@/features/accounting/server/chart/chart-of-accounts";

// O journal é DERIVADO do PaymentEntry: a cada sincronização apaga e recria os
// registros do lançamento. Assim qualquer caminho que mexa no lançamento
// (formulário, conciliação, Astro, tráfego) fica coberto sem espalhar código
// contábil pelo financeiro inteiro (spec 0051, D-2).

export const PAYMENT_ENTRY_SOURCE = "PAYMENT_ENTRY";
const BATCH_SIZE = 200;

export async function syncEntryJournals(params: { organizationId: string; entryIds: string[] }): Promise<{ synced: number }> {
  const { organizationId } = params;
  const uniqueIds = [...new Set(params.entryIds)];
  if (uniqueIds.length === 0) return { synced: 0 };

  const [systemAccounts, mappings] = await Promise.all([
    loadSystemAccounts(organizationId),
    loadAccountMappings(organizationId),
  ]);

  let synced = 0;
  for (let offset = 0; offset < uniqueIds.length; offset += BATCH_SIZE) {
    const batchIds = uniqueIds.slice(offset, offset + BATCH_SIZE);
    const entries = await prisma.paymentEntry.findMany({
      where: { organizationId, id: { in: batchIds } },
      select: {
        id: true,
        type: true,
        status: true,
        description: true,
        amount: true,
        paidAmount: true,
        dueDate: true,
        competenceDate: true,
        paidAt: true,
        costCenterId: true,
        categoryId: true,
        accountId: true,
        category: { select: { type: true } },
      },
    });

    const draftsByEntry = entries.map((entry) => ({
      entryId: entry.id,
      drafts: buildEntryJournal(
        {
          id: entry.id,
          type: entry.type,
          status: entry.status,
          description: entry.description,
          amount: entry.amount,
          paidAmount: entry.paidAmount,
          dueDate: entry.dueDate,
          competenceDate: entry.competenceDate,
          paidAt: entry.paidAt,
          costCenterId: entry.costCenterId,
        },
        {
          resultAccountId: resolveResultAccount(entry, systemAccounts, mappings),
          counterpartAccountId:
            entry.type === "RECEIVABLE" ? systemAccounts.customers_receivable : systemAccounts.suppliers_payable,
          cashAccountId: (entry.accountId && mappings.byBankAccountId.get(entry.accountId)) || systemAccounts.bank_default,
        },
      ).filter((draft) => isJournalBalanced(draft.lines)),
    }));

    await persistDrafts(organizationId, batchIds, draftsByEntry);
    synced += entries.length;
  }

  return { synced };
}

function resolveResultAccount(
  entry: { type: "RECEIVABLE" | "PAYABLE"; categoryId: string | null; category: { type: "REVENUE" | "EXPENSE" | "COST" } | null },
  systemAccounts: SystemAccountMap,
  mappings: EntryAccountMappings,
): string {
  const mapped = entry.categoryId ? mappings.byCategoryId.get(entry.categoryId) : undefined;
  if (mapped) return mapped;
  if (entry.category?.type === "COST") return systemAccounts.cost_default;
  if (entry.category?.type === "REVENUE" || entry.type === "RECEIVABLE") return systemAccounts.revenue_default;
  return systemAccounts.expense_default;
}

async function persistDrafts(
  organizationId: string,
  entryIds: string[],
  draftsByEntry: Array<{ entryId: string; drafts: JournalEntryDraft[] }>,
) {
  await prisma.$transaction(async (tx) => {
    await tx.journalEntry.deleteMany({
      where: { organizationId, sourceType: PAYMENT_ENTRY_SOURCE, sourceId: { in: entryIds } },
    });
    for (const { entryId, drafts } of draftsByEntry) {
      for (const draft of drafts) {
        await tx.journalEntry.create({
          data: {
            organizationId,
            date: draft.date,
            description: draft.description,
            sourceType: PAYMENT_ENTRY_SOURCE,
            sourceId: entryId,
            sourceEvent: draft.sourceEvent,
            lines: {
              create: draft.lines.map((line) => ({
                organizationId,
                accountId: line.accountId,
                debitCents: line.debitCents,
                creditCents: line.creditCents,
                costCenterId: line.costCenterId,
              })),
            },
          },
        });
      }
    }
  }, { timeout: 30_000 });
}

/** Reprocessa todos os lançamentos da org (backfill e botão "Reprocessar"). */
export async function syncAllEntryJournals(organizationId: string): Promise<{ synced: number }> {
  const entries = await prisma.paymentEntry.findMany({
    where: { organizationId },
    select: { id: true },
  });
  return syncEntryJournals({ organizationId, entryIds: entries.map((entry) => entry.id) });
}
