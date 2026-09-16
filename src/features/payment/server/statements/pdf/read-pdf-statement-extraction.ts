import "server-only";

import { generateObject } from "ai";
import prisma from "@/lib/prisma";
import {
  MAX_PDF_STATEMENT_TRANSACTIONS,
  isStoredPdfStatementExtraction,
  pdfStatementExtractionSchema,
  type PdfStatementExtraction,
  type StoredPdfStatementExtraction,
} from "@/features/payment/schemas/pdf-statement-extraction";
import {
  NO_EXTRACTION_KEY_MESSAGE,
  resolveExtractionModels,
  type ResolvedExtractionModel,
} from "@/features/payment/server/documents/resolve-extraction-model";
import { readAttachmentBytes } from "@/features/payment/server/documents/read-attachment-bytes";
import { extractPdfText } from "@/features/payment/server/documents/extract-pdf-text";
import { hashStatementFile } from "../read-statement-file";
import { statementFailure, type StatementFailure } from "../service-result";

// Leitura do extrato em PDF pela IA (spec 0016, D-2). Não cobra Stars: a
// cobrança acontece na importação. O resultado fica no anexo e é reaproveitado
// por outro anexo com o mesmo conteúdo, para que reenviar o arquivo não gere
// uma leitura diferente — e ids diferentes.

const MAX_FILE_BYTES_FOR_MODEL = 32 * 1024 * 1024;

const MAX_OUTPUT_TOKENS_BY_PROVIDER: Record<ResolvedExtractionModel["provider"], number> = {
  openai: 16_000,
  google: 32_000,
  anthropic: 32_000,
};

const STATEMENT_PROMPT = `Você lê extratos de conta corrente de bancos brasileiros (PDF) para conciliação bancária.

Regras:
- Liste TODAS as movimentações do período, na ordem em que aparecem.
- Valores SEMPRE em centavos inteiros e positivos em amountCents; o sentido vai em direction (CREDIT entrada, DEBIT saída).
- Datas SEMPRE em AAAA-MM-DD. Quando o extrato só mostra dia/mês, use o ano do período.
- NÃO inclua linhas de saldo ("Saldo anterior", "Saldo do dia", "Saldo final", "S A L D O") como transação — use-as só em openingBalanceCents e ledgerBalanceCents.
- Não invente valores: linha ilegível fica de fora e vira warning.
- Se houver mais de ${MAX_PDF_STATEMENT_TRANSACTIONS} movimentações, pare na ${MAX_PDF_STATEMENT_TRANSACTIONS + 1}ª e registre o warning "EXTRATO_LONGO".`;

export type ReadPdfStatementResult =
  | {
      ok: true;
      attachment: { id: string; fileName: string; originalFileName: string | null };
      extraction: StoredPdfStatementExtraction;
      fromCache: boolean;
    }
  | StatementFailure;

export function isPdfAttachment(attachment: { mimeType: string; fileName: string }): boolean {
  return (
    attachment.mimeType.includes("pdf") || attachment.fileName.toLowerCase().endsWith(".pdf")
  );
}

export function tooManyTransactionsFailure(transactionCount: number): StatementFailure {
  return statementFailure(
    "too_many_transactions",
    `Este extrato tem mais de ${MAX_PDF_STATEMENT_TRANSACTIONS} movimentações (li ${transactionCount}). Exporte o PDF em períodos menores — por exemplo, um mês ou uma quinzena por arquivo — e importe cada parte.`,
  );
}

async function findExtractionBySameFile(organizationId: string, attachmentId: string, fileHash: string) {
  const sibling = await prisma.paymentAttachment.findFirst({
    where: {
      organizationId,
      id: { not: attachmentId },
      extraction: { path: ["fileHash"], equals: fileHash },
    },
    select: { extraction: true },
    orderBy: { extractedAt: "desc" },
  });
  return isStoredPdfStatementExtraction(sibling?.extraction) ? sibling.extraction : null;
}

async function runStatementModel(params: {
  candidate: ResolvedExtractionModel;
  bytes: Uint8Array;
  pdfText: string | null;
  userId: string | null;
}): Promise<PdfStatementExtraction> {
  const fileContent = params.pdfText
    ? [{ type: "text" as const, text: `Conteúdo textual do extrato:\n\n${params.pdfText}` }]
    : [{ type: "file" as const, data: params.bytes, mediaType: "application/pdf" }];

  const { object } = await generateObject({
    model: params.candidate.model,
    schema: pdfStatementExtractionSchema,
    messages: [
      { role: "user", content: [{ type: "text", text: STATEMENT_PROMPT }, ...fileContent] },
    ],
    maxOutputTokens: MAX_OUTPUT_TOKENS_BY_PROVIDER[params.candidate.provider],
    experimental_telemetry: {
      isEnabled: true,
      functionId: "payment-pdf-statement-extract",
      metadata: params.userId ? { posthog_distinct_id: params.userId } : {},
    },
  });
  return object;
}

export async function readPdfStatementExtraction(params: {
  organizationId: string;
  attachmentId: string;
  userId?: string | null;
  force?: boolean;
}): Promise<ReadPdfStatementResult> {
  const attachment = await prisma.paymentAttachment.findFirst({
    where: { id: params.attachmentId, organizationId: params.organizationId },
    select: {
      id: true,
      fileKey: true,
      fileName: true,
      originalFileName: true,
      mimeType: true,
      extraction: true,
    },
  });
  if (!attachment) return statementFailure("not_found", "Anexo não encontrado nesta organização");

  const attachmentSummary = {
    id: attachment.id,
    fileName: attachment.fileName,
    originalFileName: attachment.originalFileName,
  };

  if (!isPdfAttachment(attachment)) {
    return statementFailure("unsupported", "Este arquivo não é um PDF.");
  }

  if (!params.force && isStoredPdfStatementExtraction(attachment.extraction)) {
    return { ok: true, attachment: attachmentSummary, extraction: attachment.extraction, fromCache: true };
  }

  const bytes = await readAttachmentBytes(attachment.fileKey);
  if (!bytes || bytes.byteLength === 0) {
    return statementFailure("not_found", "Não consegui ler o arquivo no storage.");
  }
  const fileHash = hashStatementFile(Buffer.from(bytes));

  const siblingExtraction = params.force
    ? null
    : await findExtractionBySameFile(params.organizationId, attachment.id, fileHash);
  if (siblingExtraction) {
    await prisma.paymentAttachment.update({
      where: { id: attachment.id },
      data: { extraction: siblingExtraction as unknown as object, extractedAt: new Date() },
    });
    return { ok: true, attachment: attachmentSummary, extraction: siblingExtraction, fromCache: true };
  }

  const candidates = await resolveExtractionModels(params.organizationId);
  if (candidates.length === 0) return statementFailure("no_api_key", NO_EXTRACTION_KEY_MESSAGE);

  const isTooLargeForModel = bytes.byteLength > MAX_FILE_BYTES_FOR_MODEL;
  let pdfText: string | null = isTooLargeForModel ? await extractPdfText(bytes) : null;
  if (isTooLargeForModel && !pdfText) {
    return statementFailure("unsupported", "PDF grande demais e sem texto legível. Divida o extrato por período.");
  }

  let rawExtraction: PdfStatementExtraction | null = null;
  let usedCandidate: ResolvedExtractionModel | null = null;
  let usedTextFallback = isTooLargeForModel;
  const failures: string[] = [];

  for (const candidate of candidates) {
    try {
      rawExtraction = await runStatementModel({ candidate, bytes, pdfText, userId: params.userId ?? null });
      usedCandidate = candidate;
      break;
    } catch (fileError) {
      failures.push(`${candidate.provider}/${candidate.modelId}: ${fileError instanceof Error ? fileError.message : String(fileError)}`);
      if (usedTextFallback) continue;
      // Provedor sem suporte a PDF como arquivo: tenta o texto antes do próximo.
      pdfText = pdfText ?? (await extractPdfText(bytes));
      if (!pdfText) continue;
      try {
        rawExtraction = await runStatementModel({ candidate, bytes, pdfText, userId: params.userId ?? null });
        usedCandidate = candidate;
        usedTextFallback = true;
        break;
      } catch (textError) {
        failures.push(`${candidate.provider}/${candidate.modelId} (texto): ${textError instanceof Error ? textError.message : String(textError)}`);
      }
    }
  }

  if (!rawExtraction || !usedCandidate) {
    console.error("[payment/statements/pdf] leitura falhou em todos os provedores:", failures);
    return statementFailure(
      "model_failed",
      "A IA não conseguiu ler este extrato. Se ele for longo, exporte por períodos menores; se persistir, confira a chave em Integrações.",
    );
  }

  const warnings = [...rawExtraction.warnings];
  if (usedTextFallback) warnings.push("Leitura feita a partir do texto do PDF (sem imagem).");
  if (usedCandidate !== candidates[0]) {
    warnings.push(`O provedor principal falhou; a leitura saiu do ${usedCandidate.provider} (${usedCandidate.modelId}).`);
  }

  const stored: StoredPdfStatementExtraction = {
    ...rawExtraction,
    warnings,
    kind: "BANK_STATEMENT",
    extractedAt: new Date().toISOString(),
    modelId: `${usedCandidate.provider}/${usedCandidate.modelId}`,
    usedTextFallback,
    fileHash,
  };

  await prisma.paymentAttachment.update({
    where: { id: attachment.id },
    data: { extraction: stored as unknown as object, extractedAt: new Date() },
  });

  return { ok: true, attachment: attachmentSummary, extraction: stored, fromCache: false };
}
