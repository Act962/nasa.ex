import "server-only";

import prisma from "@/lib/prisma";
import { findBankByCode } from "@/features/payment/lib/banks";
import type { NormalizedStatement, StatementSource, StatementWarning } from "./ports";
import { statementFailure, type StatementFailure } from "./service-result";
import { suggestStatementAccount, type AccountMatchReason } from "./suggest-statement-account";
import { loadAttachmentStatement, parseOfxBuffer, type StatementFileKind } from "./load-attachment-statement";

// Lê o cabeçalho do extrato sem gravar nada: de que banco e conta o arquivo é
// e qual conta cadastrada deve recebê-lo. O usuário confirma o destino antes de
// qualquer escrita, em vez de descobrir depois que entrou na conta errada.

export interface StatementInspection {
  source: StatementSource;
  kind: StatementFileKind;
  attachmentId: string | null;
  fileName: string | null;
  fileHash: string;
  bankId: string | null;
  bankName: string | null;
  statementAccountId: string | null;
  periodStart: Date | null;
  periodEnd: Date | null;
  transactionCount: number;
  creditCents: number;
  debitCents: number;
  suggestedAccountId: string | null;
  matchReason: AccountMatchReason;
  warnings: StatementWarning[];
}

export type InspectStatementResult = { ok: true; inspection: StatementInspection } | StatementFailure;

async function buildInspection(params: {
  organizationId: string;
  statement: NormalizedStatement;
  kind: StatementFileKind;
  fileHash: string;
  attachmentId: string | null;
  fileName: string | null;
  bankNameHint: string | null;
}): Promise<StatementInspection> {
  const { statement } = params;
  const { suggestedAccountId, matchReason } = await suggestStatementAccount({
    organizationId: params.organizationId,
    statement,
  });
  const sumByDirection = (direction: "CREDIT" | "DEBIT") =>
    statement.transactions
      .filter((transaction) => transaction.direction === direction)
      .reduce((sum, transaction) => sum + transaction.amountCents, 0);

  return {
    source: statement.source,
    kind: params.kind,
    attachmentId: params.attachmentId,
    fileName: params.fileName,
    fileHash: params.fileHash,
    bankId: statement.bankId,
    bankName: findBankByCode(statement.bankId)?.name ?? params.bankNameHint,
    statementAccountId: statement.accountId,
    periodStart: statement.periodStart,
    periodEnd: statement.periodEnd,
    transactionCount: statement.transactions.length,
    creditCents: sumByDirection("CREDIT"),
    debitCents: sumByDirection("DEBIT"),
    suggestedAccountId,
    matchReason,
    warnings: statement.warnings,
  };
}

export async function inspectStatementFromBuffer(params: {
  organizationId: string;
  buffer: Buffer;
}): Promise<InspectStatementResult> {
  let parsed: ReturnType<typeof parseOfxBuffer>;
  try {
    parsed = parseOfxBuffer(params.buffer);
  } catch (error) {
    return statementFailure(
      "invalid",
      error instanceof Error ? error.message : "Não foi possível ler o arquivo. Confira se é o extrato em OFX.",
    );
  }
  const inspection = await buildInspection({
    organizationId: params.organizationId,
    statement: parsed.statement,
    kind: "OFX",
    fileHash: parsed.fileHash,
    attachmentId: null,
    fileName: null,
    bankNameHint: null,
  });
  return { ok: true, inspection };
}

export async function inspectStatementFromAttachment(params: {
  organizationId: string;
  attachmentId: string;
  userId?: string | null;
}): Promise<InspectStatementResult> {
  const loaded = await loadAttachmentStatement({
    organizationId: params.organizationId,
    attachmentId: params.attachmentId,
    userId: params.userId,
    bankAccountId: null,
  });
  if (!loaded.ok) return loaded;

  const inspection = await buildInspection({
    organizationId: params.organizationId,
    statement: loaded.statement,
    kind: loaded.kind,
    fileHash: loaded.fileHash,
    attachmentId: loaded.attachmentId,
    fileName: loaded.fileName,
    bankNameHint: loaded.bankNameHint,
  });
  return { ok: true, inspection };
}

/** Quando este mesmo arquivo já entrou nesta conta — alimenta o aviso e dispensa a cobrança. */
export async function findPreviousStatementImport(params: {
  organizationId: string;
  accountId: string;
  fileHash: string;
}): Promise<Date | null> {
  const previous = await prisma.paymentStatementImport.findFirst({
    where: { organizationId: params.organizationId, accountId: params.accountId, fileHash: params.fileHash },
    select: { createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  return previous?.createdAt ?? null;
}
