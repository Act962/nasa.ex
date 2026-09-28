import "server-only";

import prisma from "@/lib/prisma";
import {
  assignMatches,
  type Suggestion,
} from "../../lib/reconciliation/assign-matches";
import { documentDigits } from "../../lib/ofx/parse-memo";

/**
 * Calcula as sugestões de um conjunto de transações numa única varredura.
 *
 * As sugestões não são persistidas: o lançamento pode ser editado ou quitado
 * por outro caminho a qualquer momento, e sugestão guardada envelhece calada.
 */

const MATCH_WINDOW_DAYS = 30;
const DAY_MS = 86_400_000;
const OPEN_STATUSES = ["PENDING", "PARTIAL", "OVERDUE"] as const;

export interface SuggestionTransaction {
  id: string;
  direction: "CREDIT" | "DEBIT";
  amountCents: number;
  postedDate: Date;
  memo: string;
  counterpartyName: string | null;
  counterpartyDocument: string | null;
}

export async function suggestMatches(params: {
  organizationId: string;
  transactions: SuggestionTransaction[];
}): Promise<Map<string, Suggestion>> {
  const { organizationId, transactions } = params;
  if (transactions.length === 0) return new Map();

  const times = transactions.map((transaction) => transaction.postedDate.getTime());
  const from = new Date(Math.min(...times) - MATCH_WINDOW_DAYS * DAY_MS);
  const to = new Date(Math.max(...times) + MATCH_WINDOW_DAYS * DAY_MS);

  const entries = await prisma.paymentEntry.findMany({
    where: {
      organizationId,
      status: { in: [...OPEN_STATUSES] },
      dueDate: { gte: from, lte: to },
    },
    select: {
      id: true,
      type: true,
      status: true,
      amount: true,
      paidAmount: true,
      dueDate: true,
      description: true,
      documentNumber: true,
      accountId: true,
      contact: { select: { document: true, name: true } },
    },
  });

  return assignMatches(
    transactions.map((transaction) => ({
      ...transaction,
      counterpartyDocumentDigits: documentDigits(transaction.counterpartyDocument),
    })),
    entries.map((entry) => ({
      id: entry.id,
      type: entry.type,
      status: entry.status,
      amount: entry.amount,
      paidAmount: entry.paidAmount,
      dueDate: entry.dueDate,
      description: entry.description,
      documentNumber: entry.documentNumber,
      accountId: entry.accountId,
      contactDocumentDigits: documentDigits(entry.contact?.document),
      contactName: entry.contact?.name ?? null,
    })),
  );
}
