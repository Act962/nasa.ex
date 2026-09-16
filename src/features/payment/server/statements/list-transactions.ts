import "server-only";

import prisma from "@/lib/prisma";
import type { Suggestion } from "@/features/payment/lib/reconciliation/assign-matches";
import { suggestMatches } from "./suggest-matches";

// Fila de transações do extrato com a sugestão de lançamento de cada uma.
// Serve a aba Conciliação e o `list_unreconciled_transactions` do Astro.

export const DEFAULT_TRANSACTIONS_PAGE_SIZE = 25;

export type StatementTransactionStatus = "PENDING" | "MATCHED" | "IGNORED";

export interface ListStatementTransactionsParams {
  organizationId: string;
  accountId?: string;
  importId?: string;
  status: StatementTransactionStatus;
  direction?: "CREDIT" | "DEBIT";
  search?: string;
  withSuggestions: boolean;
  page: number;
  pageSize?: number;
}

export async function listStatementTransactionsRecord(params: ListStatementTransactionsParams) {
  const pageSize = params.pageSize ?? DEFAULT_TRANSACTIONS_PAGE_SIZE;
  const where = {
    organizationId: params.organizationId,
    status: params.status,
    ...(params.accountId ? { accountId: params.accountId } : {}),
    ...(params.importId ? { importId: params.importId } : {}),
    ...(params.direction ? { direction: params.direction } : {}),
    ...(params.search
      ? {
          OR: [
            { memo: { contains: params.search, mode: "insensitive" as const } },
            { counterpartyName: { contains: params.search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [transactions, total, credits, debits, pendingCount] = await Promise.all([
    prisma.paymentBankTransaction.findMany({
      where,
      orderBy: { postedDate: "desc" },
      skip: (params.page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.paymentBankTransaction.count({ where }),
    prisma.paymentBankTransaction.aggregate({
      where: { ...where, direction: "CREDIT" },
      _sum: { amountCents: true },
    }),
    prisma.paymentBankTransaction.aggregate({
      where: { ...where, direction: "DEBIT" },
      _sum: { amountCents: true },
    }),
    prisma.paymentBankTransaction.count({
      where: { organizationId: params.organizationId, status: "PENDING" },
    }),
  ]);

  const suggestions: Map<string, Suggestion> =
    params.withSuggestions && params.status === "PENDING"
      ? await suggestMatches({
          organizationId: params.organizationId,
          transactions: transactions.map((transaction) => ({
            id: transaction.id,
            direction: transaction.direction,
            amountCents: transaction.amountCents,
            postedDate: transaction.postedDate,
            memo: transaction.memo,
            counterpartyName: transaction.counterpartyName,
            counterpartyDocument: transaction.counterpartyDocument,
          })),
        })
      : new Map();

  const suggestedEntryIds = [...suggestions.values()].map((suggestion) => suggestion.entryId);
  const suggestedEntries = suggestedEntryIds.length
    ? await prisma.paymentEntry.findMany({
        where: { id: { in: suggestedEntryIds } },
        select: {
          id: true,
          description: true,
          amount: true,
          paidAmount: true,
          dueDate: true,
          type: true,
          contact: { select: { name: true } },
        },
      })
    : [];
  const entryById = new Map(suggestedEntries.map((entry) => [entry.id, entry]));

  return {
    transactions: transactions.map((transaction) => {
      const suggestion = suggestions.get(transaction.id);
      const entry = suggestion ? entryById.get(suggestion.entryId) : undefined;
      return {
        ...transaction,
        suggestion:
          suggestion && entry
            ? {
                entryId: suggestion.entryId,
                score: suggestion.score,
                confidence: suggestion.confidence,
                reasons: suggestion.reasons,
                isAmbiguous: suggestion.isAmbiguous,
                entry: {
                  id: entry.id,
                  description: entry.description,
                  amount: entry.amount,
                  paidAmount: entry.paidAmount,
                  dueDate: entry.dueDate,
                  type: entry.type,
                  contactName: entry.contact?.name ?? null,
                },
              }
            : null,
      };
    }),
    total,
    totals: {
      creditCents: credits._sum.amountCents ?? 0,
      debitCents: debits._sum.amountCents ?? 0,
      pendingCount,
    },
  };
}

export type StatementTransactionListing = Awaited<ReturnType<typeof listStatementTransactionsRecord>>;
export type StatementTransactionWithSuggestion = StatementTransactionListing["transactions"][number];
