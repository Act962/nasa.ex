import "server-only";

import prisma from "@/lib/prisma";
import { logActivity } from "@/features/admin/lib/activity-logger";
import { chargeStarsByAction } from "@/features/stars/lib/charge-by-action";
import { findBankByCode } from "@/features/payment/lib/banks";
import { buildStandardAttachmentFileName } from "@/features/payment/lib/attachment-naming";
import { ingestStatement } from "./ingest-statement";
import type { NormalizedStatement, StatementSource, StatementWarning } from "./ports";
import { statementFailure, type StatementFailure } from "./service-result";
import { describeStatementAccountMismatch } from "./suggest-statement-account";
import { findPreviousStatementImport } from "./inspect-statement";
import {
  loadAttachmentStatement,
  parseOfxBuffer,
  type StatementFileKind,
} from "./load-attachment-statement";

// Importação de extrato (spec 0013 + 0016). Um único caminho para OFX em
// base64 (tela), OFX anexado e PDF anexado (tela e Astro). PDF cobra Stars
// aqui — na confirmação — e nunca na inspeção.

export const PDF_STATEMENT_STARS_ACTION = "astro_finance_statement_pdf";

export interface ImportStatementSuccess {
  ok: true;
  importId: string;
  total: number;
  imported: number;
  duplicated: number;
  invalid: number;
  warnings: StatementWarning[];
  alreadyImportedAt: Date | null;
  source: StatementSource;
  periodStart: Date | null;
  periodEnd: Date | null;
  accountName: string;
  starsCharged: number;
  renamedTo: string | null;
}

export type ImportStatementResult = ImportStatementSuccess | StatementFailure;

async function loadDestinationAccount(organizationId: string, accountId: string) {
  return prisma.paymentBankAccount.findFirst({
    where: { id: accountId, organizationId },
    select: { id: true, name: true, ofxAccountId: true },
  });
}

async function renameStatementAttachment(params: {
  organizationId: string;
  attachmentId: string;
  statement: NormalizedStatement;
  bankName: string | null;
}): Promise<string | null> {
  const attachment = await prisma.paymentAttachment.findFirst({
    where: { id: params.attachmentId, organizationId: params.organizationId },
    select: { id: true, fileName: true, originalFileName: true },
  });
  if (!attachment) return null;

  const originalFileName = attachment.originalFileName ?? attachment.fileName;
  const standardFileName = buildStandardAttachmentFileName({
    referenceDate: params.statement.periodEnd ?? new Date(),
    kind: "EXTRATO",
    contactName: params.bankName,
    originalFileName,
  });
  await prisma.paymentAttachment.update({
    where: { id: attachment.id },
    data: { fileName: standardFileName, originalFileName, kind: "EXTRATO" },
  });
  return standardFileName;
}

async function importNormalizedStatement(params: {
  organizationId: string;
  account: { id: string; name: string; ofxAccountId: string | null };
  createdById: string;
  fileName: string;
  fileHash: string;
  attachmentId: string | null;
  statement: NormalizedStatement;
  bankNameHint: string | null;
  starsAppSlug: string;
}): Promise<ImportStatementResult> {
  const { statement, account } = params;

  const mismatchMessage = describeStatementAccountMismatch(statement, account);
  if (mismatchMessage) return statementFailure("account_mismatch", mismatchMessage);

  const alreadyImportedAt = await findPreviousStatementImport({
    organizationId: params.organizationId,
    accountId: account.id,
    fileHash: params.fileHash,
  });

  let starsCharged = 0;
  // Reimportar o mesmo PDF não gera transação nova (CA-3), então não cobra de novo.
  if (statement.source === "PDF_UPLOAD" && !alreadyImportedAt) {
    const charge = await chargeStarsByAction(params.organizationId, PDF_STATEMENT_STARS_ACTION, {
      userId: params.createdById,
      appSlug: params.starsAppSlug,
      description: `Extrato PDF — ${params.fileName}`,
    });
    if (!charge.success) {
      return statementFailure(
        "insufficient_stars",
        `Saldo de Stars insuficiente pra importar este extrato em PDF (${charge.cost}★).`,
      );
    }
    starsCharged = charge.cost;
  }

  const result = await ingestStatement({
    organizationId: params.organizationId,
    accountId: account.id,
    createdById: params.createdById,
    attachmentId: params.attachmentId,
    fileName: params.fileName,
    fileHash: params.fileHash,
    statement,
  });

  const actor = await prisma.user.findUnique({
    where: { id: params.createdById },
    select: { name: true, email: true },
  });
  await logActivity({
    organizationId: params.organizationId,
    userId: params.createdById,
    userName: actor?.name ?? "",
    userEmail: actor?.email ?? "",
    appSlug: "payment",
    subAppSlug: "payment-statements",
    featureKey: "payment.statement.imported",
    action: "payment.statement.imported",
    actionLabel: `Importou extrato "${params.fileName}" (${result.imported} transações novas)`,
    resource: params.fileName,
    resourceId: result.importId,
    metadata: { ...result, accountId: account.id, source: statement.source, starsCharged },
  });

  let renamedTo: string | null = null;
  if (params.attachmentId) {
    try {
      renamedTo = await renameStatementAttachment({
        organizationId: params.organizationId,
        attachmentId: params.attachmentId,
        statement,
        bankName: findBankByCode(statement.bankId)?.name ?? params.bankNameHint ?? account.name,
      });
    } catch (error) {
      console.error("[payment/statements/import] rename attachment failed:", error);
    }
  }

  return {
    ok: true,
    ...result,
    warnings: statement.warnings,
    alreadyImportedAt,
    source: statement.source,
    periodStart: statement.periodStart,
    periodEnd: statement.periodEnd,
    accountName: account.name,
    starsCharged,
    renamedTo,
  };
}

export async function importStatementFromBuffer(params: {
  organizationId: string;
  accountId: string;
  createdById: string;
  fileName: string;
  buffer: Buffer;
}): Promise<ImportStatementResult> {
  const account = await loadDestinationAccount(params.organizationId, params.accountId);
  if (!account) return statementFailure("not_found", "Conta bancária não encontrada");

  let parsed: ReturnType<typeof parseOfxBuffer>;
  try {
    parsed = parseOfxBuffer(params.buffer);
  } catch (error) {
    return statementFailure(
      "invalid",
      error instanceof Error ? error.message : "Não foi possível ler o arquivo. Confira se é o extrato em OFX.",
    );
  }

  return importNormalizedStatement({
    organizationId: params.organizationId,
    account,
    createdById: params.createdById,
    fileName: params.fileName,
    fileHash: parsed.fileHash,
    attachmentId: null,
    statement: parsed.statement,
    bankNameHint: null,
    starsAppSlug: "payment",
  });
}

export async function importStatementFromAttachment(params: {
  organizationId: string;
  accountId: string;
  attachmentId: string;
  createdById: string;
  /** Quando informado, recusa se o arquivo for de outro formato. */
  kind?: StatementFileKind;
  /** `StarTransaction.appSlug` — "astro" quando vem do chat, "payment" da tela. */
  starsAppSlug?: string;
}): Promise<ImportStatementResult> {
  const account = await loadDestinationAccount(params.organizationId, params.accountId);
  if (!account) return statementFailure("not_found", "Conta bancária não encontrada");

  const loaded = await loadAttachmentStatement({
    organizationId: params.organizationId,
    attachmentId: params.attachmentId,
    userId: params.createdById,
    bankAccountId: account.id,
  });
  if (!loaded.ok) return loaded;
  if (params.kind && loaded.kind !== params.kind) {
    return statementFailure("unsupported", `O arquivo é ${loaded.kind}, não ${params.kind}.`);
  }

  return importNormalizedStatement({
    organizationId: params.organizationId,
    account,
    createdById: params.createdById,
    fileName: loaded.fileName,
    fileHash: loaded.fileHash,
    attachmentId: loaded.attachmentId,
    statement: loaded.statement,
    bankNameHint: loaded.bankNameHint,
    starsAppSlug: params.starsAppSlug ?? "payment",
  });
}
