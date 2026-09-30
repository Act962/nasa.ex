// Tradução de um lançamento do financeiro em partidas dobradas. Função pura:
// quem chama resolve as contas e grava. Cada lançamento gera no máximo dois
// registros: o reconhecimento (competência) e a baixa (pagamento).

export interface JournalSourceEntry {
  id: string;
  type: "RECEIVABLE" | "PAYABLE";
  status: string;
  description: string;
  amount: number;
  paidAmount: number;
  dueDate: Date;
  competenceDate: Date | null;
  paidAt: Date | null;
  costCenterId: string | null;
}

export interface ResolvedEntryAccounts {
  /** Receita, custo ou despesa da categoria. */
  resultAccountId: string;
  /** Clientes (receita) ou fornecedores (despesa). */
  counterpartAccountId: string;
  /** Conta bancária/caixa da baixa. */
  cashAccountId: string;
}

export interface JournalLineDraft {
  accountId: string;
  debitCents: number;
  creditCents: number;
  costCenterId: string | null;
}

export interface JournalEntryDraft {
  date: Date;
  description: string;
  sourceEvent: "ACCRUAL" | "SETTLEMENT";
  lines: JournalLineDraft[];
}

const NON_POSTING_STATUSES = new Set(["CANCELLED", "PENDING_APPROVAL"]);

export function buildEntryJournal(
  entry: JournalSourceEntry,
  accounts: ResolvedEntryAccounts,
): JournalEntryDraft[] {
  if (NON_POSTING_STATUSES.has(entry.status) || entry.amount <= 0) return [];

  const drafts: JournalEntryDraft[] = [];
  const accrualDate = entry.competenceDate ?? entry.dueDate;
  const isReceivable = entry.type === "RECEIVABLE";

  drafts.push({
    date: accrualDate,
    description: `${isReceivable ? "Receita" : "Despesa"} — ${entry.description}`,
    sourceEvent: "ACCRUAL",
    lines: isReceivable
      ? [
          debit(accounts.counterpartAccountId, entry.amount, null),
          credit(accounts.resultAccountId, entry.amount, entry.costCenterId),
        ]
      : [
          debit(accounts.resultAccountId, entry.amount, entry.costCenterId),
          credit(accounts.counterpartAccountId, entry.amount, null),
        ],
  });

  const settledCents = Math.min(entry.paidAmount, entry.amount);
  if (settledCents > 0) {
    drafts.push({
      date: entry.paidAt ?? accrualDate,
      description: `${isReceivable ? "Recebimento" : "Pagamento"} — ${entry.description}`,
      sourceEvent: "SETTLEMENT",
      lines: isReceivable
        ? [debit(accounts.cashAccountId, settledCents, null), credit(accounts.counterpartAccountId, settledCents, null)]
        : [debit(accounts.counterpartAccountId, settledCents, null), credit(accounts.cashAccountId, settledCents, null)],
    });
  }

  return drafts;
}

export function isJournalBalanced(lines: JournalLineDraft[]): boolean {
  const debits = lines.reduce((total, line) => total + line.debitCents, 0);
  const credits = lines.reduce((total, line) => total + line.creditCents, 0);
  return debits === credits && debits > 0;
}

function debit(accountId: string, cents: number, costCenterId: string | null): JournalLineDraft {
  return { accountId, debitCents: cents, creditCents: 0, costCenterId };
}

function credit(accountId: string, cents: number, costCenterId: string | null): JournalLineDraft {
  return { accountId, debitCents: 0, creditCents: cents, costCenterId };
}
