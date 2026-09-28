import "server-only";

import prisma from "@/lib/prisma";
import { extractFinancialDocument } from "@/features/payment/server/documents/extract-financial-document";
import { documentDigits } from "@/features/payment/lib/documents/normalize-document";
import type { StatementFailure } from "./service-result";

// Conferência da conciliação (financeiro #3): marca manual "Conferido" e a
// leitura do comprovante pela IA (Astro), que confere pagador × valor × data
// contra a transação do extrato. O resultado fica em `reviewResult` pra que o
// selo persista sem reprocessar (e sem cobrar Stars de novo).

export type ReviewFieldStatus = "match" | "divergent" | "unknown";

export interface AstroReviewResult {
  checkedAt: string;
  attachmentId: string;
  matches: boolean;
  payer: { status: ReviewFieldStatus; expected: string | null; found: string | null };
  amount: { status: ReviewFieldStatus; expectedCents: number; foundCents: number | null };
  date: { status: ReviewFieldStatus; expected: string | null; found: string | null };
  warnings: string[];
}

type MarkResult = { ok: true } | StatementFailure;
type AstroResult = { ok: true; review: AstroReviewResult } | StatementFailure;

function normalizeName(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Nomes conferem quando compartilham um token significativo (≥3 letras). */
function namesMatch(expected: string | null, found: string | null): boolean {
  const expectedTokens = normalizeName(expected).split(" ").filter((token) => token.length >= 3);
  const foundTokens = new Set(normalizeName(found).split(" ").filter((token) => token.length >= 3));
  if (expectedTokens.length === 0 || foundTokens.size === 0) return false;
  return expectedTokens.some((token) => foundTokens.has(token));
}

function toIsoDay(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

export async function markTransactionReviewedRecord(params: {
  organizationId: string;
  transactionId: string;
  reviewedById: string;
  reviewed: boolean;
}): Promise<MarkResult> {
  const transaction = await prisma.paymentBankTransaction.findFirst({
    where: { id: params.transactionId, organizationId: params.organizationId },
    select: { id: true },
  });
  if (!transaction) {
    return { ok: false, reason: "not_found", message: "Transação não encontrada" };
  }
  await prisma.paymentBankTransaction.update({
    where: { id: params.transactionId },
    data: params.reviewed
      ? { reviewedAt: new Date(), reviewedById: params.reviewedById }
      : { reviewedAt: null, reviewedById: null },
  });
  return { ok: true };
}

export async function reviewTransactionWithAstro(params: {
  organizationId: string;
  transactionId: string;
  userId: string;
}): Promise<AstroResult> {
  const transaction = await prisma.paymentBankTransaction.findFirst({
    where: { id: params.transactionId, organizationId: params.organizationId },
    select: {
      id: true,
      amountCents: true,
      postedDate: true,
      counterpartyName: true,
      counterpartyDocument: true,
      matchedEntryId: true,
    },
  });
  if (!transaction) {
    return { ok: false, reason: "not_found", message: "Transação não encontrada" };
  }
  if (!transaction.matchedEntryId) {
    return { ok: false, reason: "invalid", message: "Transação sem lançamento conciliado" };
  }

  const attachment = await prisma.paymentAttachment.findFirst({
    where: {
      organizationId: params.organizationId,
      entryId: transaction.matchedEntryId,
      kind: "COMPROVANTE",
    },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (!attachment) {
    return {
      ok: false,
      reason: "not_found",
      message: "Nenhum comprovante anexado ao lançamento conciliado",
    };
  }

  const extractionResult = await extractFinancialDocument({
    organizationId: params.organizationId,
    attachmentId: attachment.id,
    userId: params.userId,
  });
  if (!extractionResult.ok) {
    return { ok: false, reason: "invalid", message: extractionResult.message };
  }

  const extraction = extractionResult.extraction;
  const expectedPayerName = extraction.payer?.name ?? null;
  const expectedPayerDocument = documentDigits(extraction.payer?.document ?? null);
  const foundPayerName = transaction.counterpartyName;
  const foundPayerDocument = documentDigits(transaction.counterpartyDocument);

  const payerStatus: ReviewFieldStatus = !expectedPayerName && !expectedPayerDocument
    ? "unknown"
    : (expectedPayerDocument && foundPayerDocument
        ? expectedPayerDocument === foundPayerDocument
        : namesMatch(expectedPayerName, foundPayerName))
      ? "match"
      : "divergent";

  const amountStatus: ReviewFieldStatus = extraction.amountCents === null
    ? "unknown"
    : extraction.amountCents === transaction.amountCents
      ? "match"
      : "divergent";

  const expectedDate = extraction.dueDate ?? extraction.issueDate ?? null;
  const foundDate = toIsoDay(transaction.postedDate);
  const dateStatus: ReviewFieldStatus = !expectedDate
    ? "unknown"
    : expectedDate === foundDate
      ? "match"
      : "divergent";

  const matches =
    payerStatus !== "divergent" && amountStatus === "match" && dateStatus !== "divergent";

  const review: AstroReviewResult = {
    checkedAt: new Date().toISOString(),
    attachmentId: attachment.id,
    matches,
    payer: { status: payerStatus, expected: expectedPayerName, found: foundPayerName },
    amount: { status: amountStatus, expectedCents: transaction.amountCents, foundCents: extraction.amountCents },
    date: { status: dateStatus, expected: expectedDate, found: foundDate },
    warnings: extraction.warnings ?? [],
  };

  await prisma.paymentBankTransaction.update({
    where: { id: transaction.id },
    data: {
      reviewResult: review as unknown as object,
      // Confere sozinho só quando tudo bate; divergência exige olho humano.
      ...(matches ? { reviewedAt: new Date(), reviewedById: params.userId } : {}),
    },
  });

  return { ok: true, review };
}
