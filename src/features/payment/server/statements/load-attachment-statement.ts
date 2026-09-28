import "server-only";

import prisma from "@/lib/prisma";
import { MAX_PDF_STATEMENT_TRANSACTIONS } from "@/features/payment/schemas/pdf-statement-extraction";
import { decodeOfxBuffer } from "@/features/payment/lib/ofx/decode-ofx-buffer";
import { parseOfxStatement } from "@/features/payment/lib/ofx/parse-statement";
import { readAttachmentBytes } from "@/features/payment/server/documents/read-attachment-bytes";
import type { NormalizedStatement } from "./ports";
import { hashStatementFile } from "./read-statement-file";
import { statementFailure, type StatementFailure } from "./service-result";
import { buildNormalizedPdfStatement } from "./pdf/parse-pdf-statement";
import {
  isPdfAttachment,
  readPdfStatementExtraction,
  tooManyTransactionsFailure,
} from "./pdf/read-pdf-statement-extraction";

// Um `PaymentAttachment` (OFX ou PDF) vira `NormalizedStatement`. Usado pela
// inspeção e pela importação, na tela e no Astro.

export type StatementFileKind = "OFX" | "PDF";

export function resolveStatementFileKind(file: { mimeType: string; fileName: string }): StatementFileKind | null {
  if (isPdfAttachment(file)) return "PDF";
  if (file.fileName.toLowerCase().endsWith(".ofx") || file.mimeType.includes("ofx")) return "OFX";
  return null;
}

export function parseOfxBuffer(buffer: Buffer): { statement: NormalizedStatement; fileHash: string } {
  if (buffer.length === 0) throw new Error("Arquivo vazio");
  const fileHash = hashStatementFile(buffer);
  const { content } = decodeOfxBuffer(buffer);
  return { statement: parseOfxStatement(content, "OFX_UPLOAD"), fileHash };
}

export type LoadAttachmentStatementResult =
  | {
      ok: true;
      kind: StatementFileKind;
      statement: NormalizedStatement;
      fileHash: string;
      /** Nome como o usuário enviou — é o que vai para o histórico de importações. */
      fileName: string;
      attachmentId: string;
      bankNameHint: string | null;
    }
  | StatementFailure;

export async function loadAttachmentStatement(params: {
  organizationId: string;
  attachmentId: string;
  userId?: string | null;
  /** Conta de destino; na inspeção ainda não existe e os ids sintéticos não importam. */
  bankAccountId: string | null;
}): Promise<LoadAttachmentStatementResult> {
  const attachment = await prisma.paymentAttachment.findFirst({
    where: { id: params.attachmentId, organizationId: params.organizationId },
    select: { id: true, fileKey: true, fileName: true, originalFileName: true, mimeType: true },
  });
  if (!attachment) return statementFailure("not_found", "Anexo não encontrado nesta organização");

  const kind = resolveStatementFileKind(attachment);
  if (!kind) {
    return statementFailure("unsupported", "Extrato precisa ser OFX ou PDF.");
  }
  const originalFileName = attachment.originalFileName ?? attachment.fileName;

  if (kind === "OFX") {
    const bytes = await readAttachmentBytes(attachment.fileKey);
    if (!bytes) return statementFailure("not_found", "Não consegui ler o arquivo no storage.");
    try {
      const { statement, fileHash } = parseOfxBuffer(Buffer.from(bytes));
      return {
        ok: true,
        kind,
        statement,
        fileHash,
        fileName: originalFileName,
        attachmentId: attachment.id,
        bankNameHint: null,
      };
    } catch (error) {
      return statementFailure(
        "invalid",
        error instanceof Error ? error.message : "Não foi possível ler o arquivo. Confira se é o extrato em OFX.",
      );
    }
  }

  const readResult = await readPdfStatementExtraction({
    organizationId: params.organizationId,
    attachmentId: attachment.id,
    userId: params.userId,
  });
  if (!readResult.ok) return readResult;
  if (readResult.extraction.transactions.length > MAX_PDF_STATEMENT_TRANSACTIONS) {
    return tooManyTransactionsFailure(readResult.extraction.transactions.length);
  }

  return {
    ok: true,
    kind,
    statement: buildNormalizedPdfStatement({
      extraction: readResult.extraction,
      bankAccountId: params.bankAccountId ?? "inspection",
    }),
    fileHash: readResult.extraction.fileHash,
    fileName: originalFileName,
    attachmentId: attachment.id,
    bankNameHint: readResult.extraction.bankName,
  };
}
