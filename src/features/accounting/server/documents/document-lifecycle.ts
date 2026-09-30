import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { findDocumentType } from "@/features/accounting/lib/compliance/document-catalog";
import { syncFiscalObligations } from "@/features/accounting/server/obligations/sync-fiscal-obligations";

export const CUSTOM_DOCUMENT_TYPE = "CUSTOM";

export type CompanyDocumentStatus = "VALID" | "PENDING_REVIEW" | "REPLACED";

export function isKnownDocumentType(typeCode: string): boolean {
  return typeCode === CUSTOM_DOCUMENT_TYPE || !!findDocumentType(typeCode);
}

/** Documento com validade que chega sem datas precisa de revisão antes de contar. */
export function resolveUploadStatus(typeCode: string, hasDates: boolean): CompanyDocumentStatus {
  const documentType = findDocumentType(typeCode);
  const hasValidity = !!documentType && documentType.defaultValidityDays !== null;
  return hasValidity && !hasDates ? "PENDING_REVIEW" : "VALID";
}

/**
 * Documento sem competência substitui o anterior do mesmo tipo (ex.: a CND
 * nova aposenta a velha). Mensais convivem: cada mês é um documento.
 */
export async function replacePreviousDocuments(
  tx: Prisma.TransactionClient,
  params: { organizationId: string; typeCode: string; keepDocumentId: string; period: string | null },
) {
  if (params.period || params.typeCode === CUSTOM_DOCUMENT_TYPE) return;
  await tx.companyDocument.updateMany({
    where: {
      organizationId: params.organizationId,
      typeCode: params.typeCode,
      period: null,
      status: { not: "REPLACED" },
      id: { not: params.keepDocumentId },
    },
    data: { status: "REPLACED" },
  });
}

/** Ao excluir o documento vigente, o último substituído volta a valer. */
export async function restoreLatestReplacedDocument(
  tx: Prisma.TransactionClient,
  params: { organizationId: string; typeCode: string },
) {
  const activeCount = await tx.companyDocument.count({
    where: { organizationId: params.organizationId, typeCode: params.typeCode, period: null, status: { not: "REPLACED" } },
  });
  if (activeCount > 0) return;
  const latestReplaced = await tx.companyDocument.findFirst({
    where: { organizationId: params.organizationId, typeCode: params.typeCode, period: null, status: "REPLACED" },
    orderBy: [{ issuedAt: "desc" }, { createdAt: "desc" }],
    select: { id: true },
  });
  if (latestReplaced) {
    await tx.companyDocument.update({ where: { id: latestReplaced.id }, data: { status: "VALID" } });
  }
}

/** Documentos com competência quitam obrigações; roda depois do commit, best-effort. */
export async function afterCompanyDocumentChange(organizationId: string) {
  try {
    await syncFiscalObligations(organizationId);
  } catch (error) {
    console.warn("[accounting/documents] sync_obligations_failed", organizationId, error);
  }
}

/** "AAAA-MM-DD" → Date em UTC meio-dia (não escorrega de dia por fuso). */
export function parseDateOnly(value: string | null | undefined): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function onlyDigits(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}
