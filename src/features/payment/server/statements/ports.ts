/**
 * A fronteira da conciliação bancária.
 *
 * Tudo que produz transações — hoje o arquivo OFX, amanhã um inbox de e-mail
 * ou um agregador de Open Finance — entrega um `NormalizedStatement`. Daqui
 * para dentro nada sabe de onde o dado veio, e é isso que torna a próxima
 * fonte um adaptador em vez de uma reescrita.
 */

export type StatementSource = "OFX_UPLOAD" | "EMAIL_INBOX" | "AGGREGATOR" | "PDF_UPLOAD";

export const STATEMENT_SOURCES = ["OFX_UPLOAD", "EMAIL_INBOX", "AGGREGATOR", "PDF_UPLOAD"] as const;
export type StatementDirection = "CREDIT" | "DEBIT";

// `type` (não `interface`) para ser atribuível a `Prisma.InputJsonValue`.
export type StatementWarning = {
  code: string;
  message: string;
  severity: "info" | "warning" | "error";
};

export interface NormalizedBankTransaction {
  /** FITID no OFX; id do provedor quando vier de agregador. */
  externalId: string;
  direction: StatementDirection;
  /** Sempre positivo — o sinal vive em `direction`. */
  amountCents: number;
  postedAt: Date;
  /** Dia de calendário a meio-dia UTC, para comparar com `dueDate`. */
  postedDate: Date;
  memo: string;
  memoKind: string | null;
  counterpartyName: string | null;
  counterpartyDocument: string | null;
  counterpartyDocumentMasked: boolean;
  raw: Record<string, unknown>;
}

export interface NormalizedStatement {
  source: StatementSource;
  bankId: string | null;
  accountId: string | null;
  currency: string | null;
  periodStart: Date | null;
  periodEnd: Date | null;
  ledgerBalanceCents: number | null;
  ledgerBalanceAt: Date | null;
  transactions: NormalizedBankTransaction[];
  warnings: StatementWarning[];
}

/** Implementado por cada fonte futura (Pluggy, Belvo, inbox). */
export interface StatementProvider {
  readonly source: StatementSource;
  fetchStatements(params: {
    organizationId: string;
    accountId: string;
    since?: Date;
  }): Promise<NormalizedStatement[]>;
}
