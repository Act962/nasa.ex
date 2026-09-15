import "server-only";

import { PutObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";
import prisma from "@/lib/prisma";
import { S3 } from "@/lib/s3-client";
import { resolveGoogleAccessToken } from "@/features/integrations/lib/oauth/resolve-google-access-token";
import { getGmailMessage } from "@/http/gmail/get-message";
import { getGmailAttachmentBytes } from "@/http/gmail/get-attachment";
import { guessAttachmentKind } from "@/features/payment/lib/attachments";
import { extractFinancialDocument } from "@/features/payment/server/documents/extract-financial-document";
import type { StoredFinancialExtraction } from "@/features/payment/schemas/financial-document-extraction";
import {
  GMAIL_PART_KEY_PREFIX,
  GMAIL_READONLY_SCOPE,
  IGNORE_CONFIDENCE_THRESHOLD,
} from "./inbox-constants";

// Um anexo do e-mail vira documento financeiro (spec 0018, RF-3): baixa do
// Gmail → R2 → `PaymentAttachment` (sourceChannel gmail) → extração (5★, com
// cache) → item PROPOSED, ou IGNORED quando claramente não é financeiro (CA-8).

export type IngestInboxItemOutcome =
  | "PROPOSED"
  | "IGNORED"
  | "FAILED"
  | "RETRY_LATER"
  | "SKIPPED";

export interface InboxExtractionSummary {
  documentType: StoredFinancialExtraction["documentType"];
  direction: StoredFinancialExtraction["direction"];
  issuerName: string | null;
  amountCents: number | null;
  dueDate: string | null;
  documentNumber: string | null;
  confidence: number;
}

function toExtractionSummary(extraction: StoredFinancialExtraction): InboxExtractionSummary {
  return {
    documentType: extraction.documentType,
    direction: extraction.direction,
    issuerName: extraction.issuer?.name ?? null,
    amountCents: extraction.amountCents,
    dueDate: extraction.dueDate,
    documentNumber: extraction.documentNumber,
    confidence: extraction.confidence,
  };
}

function extensionOf(fileName: string, mimeType: string): string {
  const fromName = fileName.includes(".") ? fileName.split(".").pop() : null;
  if (fromName && fromName.length <= 5) return fromName.toLowerCase();
  if (mimeType.includes("pdf")) return "pdf";
  if (mimeType.includes("png")) return "png";
  if (mimeType.includes("webp")) return "webp";
  return "jpg";
}

async function markItem(
  itemId: string,
  data: { status?: "PROPOSED" | "IGNORED" | "FAILED"; errorMessage?: string | null; extraction?: object },
) {
  await prisma.paymentInboxItem.update({ where: { id: itemId }, data });
}

async function storeGmailAttachment(params: {
  organizationId: string;
  item: { id: string; gmailMessageId: string; gmailAttachmentId: string; subject: string; fromEmail: string };
}): Promise<{ ok: true; attachmentId: string } | { ok: false; retryLater: boolean; message: string }> {
  const token = await resolveGoogleAccessToken({
    organizationId: params.organizationId,
    requiredScope: GMAIL_READONLY_SCOPE,
  });
  if (!token.ok) return { ok: false, retryLater: true, message: token.message };

  const message = await getGmailMessage({
    accessToken: token.accessToken,
    messageId: params.item.gmailMessageId,
  });
  const partId = params.item.gmailAttachmentId.replace(GMAIL_PART_KEY_PREFIX, "");
  const gmailAttachment = message.attachments.find((attachment) => attachment.partId === partId);
  if (!gmailAttachment) {
    return { ok: false, retryLater: false, message: "Anexo não encontrado mais no e-mail" };
  }

  const bytes = await getGmailAttachmentBytes({
    accessToken: token.accessToken,
    messageId: params.item.gmailMessageId,
    attachmentId: gmailAttachment.attachmentId,
  });
  const mimeType = gmailAttachment.fileName.toLowerCase().endsWith(".pdf")
    ? "application/pdf"
    : gmailAttachment.mimeType;
  const fileKey = `payment/attachments/${params.organizationId}/${uuidv4()}.${extensionOf(gmailAttachment.fileName, mimeType)}`;

  await S3.send(
    new PutObjectCommand({
      Bucket: process.env.NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES!,
      Key: fileKey,
      Body: bytes,
      ContentType: mimeType,
    }),
  );

  const attachment = await prisma.paymentAttachment.create({
    data: {
      organizationId: params.organizationId,
      fileKey,
      fileName: gmailAttachment.fileName,
      originalFileName: gmailAttachment.fileName,
      mimeType,
      sizeBytes: bytes.byteLength,
      kind: guessAttachmentKind(gmailAttachment.fileName),
      sourceChannel: "gmail",
      description: `E-mail de ${params.item.fromEmail}: ${params.item.subject}`.slice(0, 500),
      uploadedById: null,
    },
    select: { id: true },
  });
  await prisma.paymentInboxItem.update({
    where: { id: params.item.id },
    data: { attachmentId: attachment.id },
  });
  return { ok: true, attachmentId: attachment.id };
}

export async function ingestInboxItem(params: {
  organizationId: string;
  itemId: string;
  actorUserId: string | null;
}): Promise<IngestInboxItemOutcome> {
  const item = await prisma.paymentInboxItem.findFirst({
    where: { id: params.itemId, organizationId: params.organizationId },
    select: {
      id: true,
      status: true,
      attachmentId: true,
      gmailMessageId: true,
      gmailAttachmentId: true,
      subject: true,
      fromEmail: true,
    },
  });
  if (!item || item.status !== "NEW") return "SKIPPED";

  let attachmentId = item.attachmentId;
  if (!attachmentId) {
    try {
      const stored = await storeGmailAttachment({ organizationId: params.organizationId, item });
      if (!stored.ok) {
        await markItem(item.id, stored.retryLater
          ? { errorMessage: stored.message }
          : { status: "FAILED", errorMessage: stored.message });
        return stored.retryLater ? "RETRY_LATER" : "FAILED";
      }
      attachmentId = stored.attachmentId;
    } catch (error) {
      await markItem(item.id, {
        status: "FAILED",
        errorMessage: `Falha ao baixar o anexo: ${error instanceof Error ? error.message : String(error)}`.slice(0, 500),
      });
      return "FAILED";
    }
  }

  if (!params.actorUserId) {
    await markItem(item.id, { errorMessage: "Nenhum usuário responsável pela leitura (owner da empresa ausente)" });
    return "RETRY_LATER";
  }

  const result = await extractFinancialDocument({
    organizationId: params.organizationId,
    attachmentId,
    userId: params.actorUserId,
  });

  if (!result.ok) {
    // Sem saldo ou sem chave de IA nada foi cobrado: fica NEW e tenta de novo
    // no próximo ciclo, sem baixar o arquivo outra vez.
    const canRetry = result.reason === "insufficient_stars" || result.reason === "no_api_key";
    await markItem(item.id, canRetry
      ? { errorMessage: result.message }
      : { status: "FAILED", errorMessage: result.message });
    return canRetry ? "RETRY_LATER" : "FAILED";
  }

  const summary = toExtractionSummary(result.extraction);
  const isClearlyNotFinancial =
    summary.documentType === "OUTRO" && summary.confidence < IGNORE_CONFIDENCE_THRESHOLD;

  await markItem(item.id, {
    status: isClearlyNotFinancial ? "IGNORED" : "PROPOSED",
    errorMessage: null,
    extraction: summary as unknown as object,
  });
  return isClearlyNotFinancial ? "IGNORED" : "PROPOSED";
}
