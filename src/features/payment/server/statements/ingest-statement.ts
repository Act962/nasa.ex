import "server-only";

import prisma from "@/lib/prisma";
import type { NormalizedStatement } from "./ports";

/**
 * Único caminho de escrita da conciliação. Recebe o extrato já normalizado —
 * não sabe se veio de upload, de um inbox de e-mail ou de um agregador.
 *
 * A idempotência é estrutural: `@@unique([organizationId, accountId,
 * externalId])` com `skipDuplicates`. Reimportar o mesmo extrato não cria nada
 * e não ressuscita transação que o usuário já ignorou.
 */

export interface IngestParams {
  organizationId: string;
  accountId: string;
  createdById: string | null;
  attachmentId?: string | null;
  fileName: string;
  fileHash: string;
  statement: NormalizedStatement;
}

export interface IngestResult {
  importId: string;
  total: number;
  imported: number;
  duplicated: number;
  invalid: number;
}

export async function ingestStatement(params: IngestParams): Promise<IngestResult> {
  const { statement } = params;
  const invalid = statement.warnings.filter((w) => w.severity === "error").length;

  // Transação curta e só com escritas: parse e I/O já aconteceram antes.
  return prisma.$transaction(async (tx) => {
    const created = await tx.paymentStatementImport.create({
      data: {
        organizationId: params.organizationId,
        accountId: params.accountId,
        attachmentId: params.attachmentId ?? null,
        source: statement.source,
        fileName: params.fileName,
        fileHash: params.fileHash,
        ofxBankId: statement.bankId,
        ofxAccountId: statement.accountId,
        currency: statement.currency,
        periodStart: statement.periodStart,
        periodEnd: statement.periodEnd,
        ledgerBalanceCents: statement.ledgerBalanceCents,
        ledgerBalanceAt: statement.ledgerBalanceAt,
        totalCount: statement.transactions.length,
        invalidCount: invalid,
        status: "PROCESSING",
        warnings: statement.warnings.length > 0 ? statement.warnings : undefined,
        createdById: params.createdById,
      },
      select: { id: true },
    });

    const inserted = await tx.paymentBankTransaction.createMany({
      skipDuplicates: true,
      data: statement.transactions.map((transaction) => ({
        organizationId: params.organizationId,
        accountId: params.accountId,
        importId: created.id,
        source: statement.source,
        externalId: transaction.externalId,
        direction: transaction.direction,
        amountCents: transaction.amountCents,
        postedAt: transaction.postedAt,
        postedDate: transaction.postedDate,
        memo: transaction.memo,
        memoKind: transaction.memoKind,
        counterpartyName: transaction.counterpartyName,
        counterpartyDocument: transaction.counterpartyDocument,
        counterpartyDocumentMasked: transaction.counterpartyDocumentMasked,
        rawPayload: transaction.raw as object,
      })),
    });

    const duplicated = statement.transactions.length - inserted.count;

    await tx.paymentStatementImport.update({
      where: { id: created.id },
      data: {
        importedCount: inserted.count,
        duplicateCount: duplicated,
        status: "COMPLETED",
      },
    });

    // O extrato é a fonte mais confiável de saldo que temos; guardamos à parte
    // de `balance`, que é digitado e alimenta a projeção.
    // Só o OFX grava os ids da conta: o número lido de um PDF vem sem formato
    // fixo e quebraria o casamento exato do próximo OFX (spec 0016, D-4).
    const isOfxStatement = statement.source === "OFX_UPLOAD";
    if (statement.ledgerBalanceCents !== null) {
      await tx.paymentBankAccount.update({
        where: { id: params.accountId },
        data: {
          statementBalanceCents: statement.ledgerBalanceCents,
          statementBalanceAt: statement.ledgerBalanceAt,
          ...(isOfxStatement && statement.bankId ? { ofxBankId: statement.bankId } : {}),
          ...(isOfxStatement && statement.accountId ? { ofxAccountId: statement.accountId } : {}),
        },
      });
    }

    return {
      importId: created.id,
      total: statement.transactions.length,
      imported: inserted.count,
      duplicated,
      invalid,
    };
  });
}
