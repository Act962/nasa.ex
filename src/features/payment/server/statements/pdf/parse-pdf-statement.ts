import "server-only";

import {
  MAX_PDF_STATEMENT_TRANSACTIONS,
  type StoredPdfStatementExtraction,
} from "@/features/payment/schemas/pdf-statement-extraction";
import { isValidDateValue, parseCalendarDate } from "@/features/payment/lib/dates";
import { BRAZILIAN_BANKS } from "@/features/payment/lib/banks";
import { parsePaymentMemo } from "@/features/payment/lib/ofx/parse-memo";
import type {
  NormalizedBankTransaction,
  NormalizedStatement,
  StatementWarning,
} from "../ports";
import type { StatementFailure } from "../service-result";
import {
  buildSyntheticExternalId,
  normalizeStatementMemo,
} from "./build-synthetic-external-id";
import {
  readPdfStatementExtraction,
  tooManyTransactionsFailure,
} from "./read-pdf-statement-extraction";

// Extrato PDF → `NormalizedStatement` (spec 0016, RF-2). Daqui para dentro a
// conciliação não sabe que o dado veio de IA.

const MASK_CHARS = /[•*]/;

function onlyDigits(value: string | null | undefined): string | null {
  const digits = value?.replace(/\D/g, "") ?? "";
  return digits.length > 0 ? digits : null;
}

function resolveBankCode(extraction: StoredPdfStatementExtraction): string | null {
  const bankCodeDigits = onlyDigits(extraction.bankCode);
  if (bankCodeDigits) return bankCodeDigits.padStart(3, "0").slice(-3);
  if (!extraction.bankName) return null;

  const normalizedBankName = extraction.bankName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
  const matchedBank = BRAZILIAN_BANKS.find((bank) => {
    const names = [bank.name, ...(bank.aliases ?? [])].map((name) =>
      name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(),
    );
    return names.some((name) => name.length > 2 && normalizedBankName.includes(name));
  });
  return matchedBank?.code ?? null;
}

function formatCentsForWarning(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function buildNormalizedPdfStatement(params: {
  extraction: StoredPdfStatementExtraction;
  /** `PaymentBankAccount.id` de destino — entra no id sintético. */
  bankAccountId: string;
}): NormalizedStatement {
  const { extraction } = params;
  const warnings: StatementWarning[] = [
    {
      code: "READ_BY_AI",
      message: "Extrato lido por IA a partir do PDF — confira valores antes de conciliar.",
      severity: "info",
    },
    ...extraction.warnings.map((message) => ({
      code: "MODEL_NOTE",
      message,
      severity: "info" as const,
    })),
  ];

  const occurrencesByTuple = new Map<string, number>();
  const transactions: NormalizedBankTransaction[] = [];

  extraction.transactions.forEach((rawTransaction, index) => {
    if (!isValidDateValue(rawTransaction.postedDate) || rawTransaction.amountCents <= 0) {
      warnings.push({
        code: "INVALID_TRANSACTION",
        message: `Linha ${index + 1} ignorada: data "${rawTransaction.postedDate}" ou valor inválido.`,
        severity: "error",
      });
      return;
    }

    const memo = rawTransaction.description.trim() || "Sem descrição";
    const normalizedMemo = normalizeStatementMemo(memo);
    const tupleKey = [
      rawTransaction.postedDate,
      rawTransaction.direction,
      rawTransaction.amountCents,
      normalizedMemo,
    ].join("|");
    const occurrenceIndex = occurrencesByTuple.get(tupleKey) ?? 0;
    occurrencesByTuple.set(tupleKey, occurrenceIndex + 1);

    const memoInfo = parsePaymentMemo(memo);
    const counterpartyDocument = rawTransaction.counterpartyDocument ?? memoInfo.counterpartyDocument;
    const postedDate = parseCalendarDate(rawTransaction.postedDate);

    transactions.push({
      externalId: buildSyntheticExternalId({
        bankAccountId: params.bankAccountId,
        postedDate: rawTransaction.postedDate,
        direction: rawTransaction.direction,
        amountCents: rawTransaction.amountCents,
        normalizedMemo,
        occurrenceIndex,
      }),
      direction: rawTransaction.direction,
      amountCents: rawTransaction.amountCents,
      postedAt: postedDate,
      postedDate,
      memo,
      memoKind: memoInfo.memoKind,
      counterpartyName: rawTransaction.counterpartyName ?? memoInfo.counterpartyName,
      counterpartyDocument,
      counterpartyDocumentMasked: counterpartyDocument ? MASK_CHARS.test(counterpartyDocument) : false,
      raw: { ...rawTransaction, source: "pdf", line: index + 1 },
    });
  });

  const creditCents = transactions
    .filter((transaction) => transaction.direction === "CREDIT")
    .reduce((sum, transaction) => sum + transaction.amountCents, 0);
  const debitCents = transactions
    .filter((transaction) => transaction.direction === "DEBIT")
    .reduce((sum, transaction) => sum + transaction.amountCents, 0);

  // Saldo lido por IA só vira `statementBalanceCents` quando a soma confere;
  // um dígito trocado não pode contaminar o saldo da conta.
  let verifiedLedgerBalanceCents: number | null = null;
  if (extraction.openingBalanceCents !== null && extraction.ledgerBalanceCents !== null) {
    const expectedClosingCents = extraction.openingBalanceCents + creditCents - debitCents;
    if (expectedClosingCents === extraction.ledgerBalanceCents) {
      verifiedLedgerBalanceCents = extraction.ledgerBalanceCents;
    } else {
      warnings.push({
        code: "BALANCE_MISMATCH",
        message: `A soma das movimentações não fecha com o saldo do extrato: saldo inicial ${formatCentsForWarning(extraction.openingBalanceCents)} + entradas ${formatCentsForWarning(creditCents)} − saídas ${formatCentsForWarning(debitCents)} = ${formatCentsForWarning(expectedClosingCents)}, mas o extrato diz ${formatCentsForWarning(extraction.ledgerBalanceCents)}. Pode haver linha lida errado ou faltando.`,
        severity: "warning",
      });
    }
  } else if (extraction.ledgerBalanceCents !== null) {
    warnings.push({
      code: "BALANCE_UNVERIFIED",
      message: "O extrato não mostra o saldo inicial, então não deu pra conferir a soma das movimentações.",
      severity: "info",
    });
  }

  const sortedDates = extraction.transactions
    .map((transaction) => transaction.postedDate)
    .filter((date) => isValidDateValue(date))
    .sort();
  const periodStartIso =
    extraction.periodStart && isValidDateValue(extraction.periodStart) ? extraction.periodStart : sortedDates[0];
  const periodEndIso =
    extraction.periodEnd && isValidDateValue(extraction.periodEnd)
      ? extraction.periodEnd
      : sortedDates[sortedDates.length - 1];
  const periodEnd = periodEndIso ? parseCalendarDate(periodEndIso) : null;

  return {
    source: "PDF_UPLOAD",
    bankId: resolveBankCode(extraction),
    accountId: onlyDigits(extraction.accountNumber),
    currency: extraction.currency ?? "BRL",
    periodStart: periodStartIso ? parseCalendarDate(periodStartIso) : null,
    periodEnd,
    ledgerBalanceCents: verifiedLedgerBalanceCents,
    ledgerBalanceAt: verifiedLedgerBalanceCents !== null ? periodEnd : null,
    transactions,
    warnings,
  };
}

export type ParsePdfStatementResult =
  | {
      ok: true;
      statement: NormalizedStatement;
      extraction: StoredPdfStatementExtraction;
      attachment: { id: string; fileName: string; originalFileName: string | null };
      fromCache: boolean;
    }
  | StatementFailure;

export async function parsePdfStatementWithLlm(params: {
  organizationId: string;
  attachmentId: string;
  accountId: string;
  userId?: string | null;
}): Promise<ParsePdfStatementResult> {
  const readResult = await readPdfStatementExtraction({
    organizationId: params.organizationId,
    attachmentId: params.attachmentId,
    userId: params.userId,
  });
  if (!readResult.ok) return readResult;

  if (readResult.extraction.transactions.length > MAX_PDF_STATEMENT_TRANSACTIONS) {
    return tooManyTransactionsFailure(readResult.extraction.transactions.length);
  }

  return {
    ok: true,
    statement: buildNormalizedPdfStatement({
      extraction: readResult.extraction,
      bankAccountId: params.accountId,
    }),
    extraction: readResult.extraction,
    attachment: readResult.attachment,
    fromCache: readResult.fromCache,
  };
}
