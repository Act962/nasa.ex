import "server-only";

import prisma from "@/lib/prisma";
import {
  DOCUMENT_GROUP_LABELS,
  DOCUMENT_SCOPE_LABELS,
  findDocumentType,
} from "@/features/accounting/lib/compliance/document-catalog";
import { EXPIRING_SOON_DAYS } from "@/features/accounting/lib/compliance/compute-regularity-score";
import { isStoredCompanyDocumentExtraction } from "@/features/accounting/schemas/company-document-extraction";
import { CUSTOM_DOCUMENT_TYPE } from "./document-lifecycle";

const DAY_MS = 86_400_000;

export type CompanyDocumentDisplayStatus = "VALID" | "EXPIRING_SOON" | "EXPIRED" | "PENDING_REVIEW" | "REPLACED";

export interface CompanyDocumentRow {
  id: string;
  typeCode: string;
  typeLabel: string;
  groupLabel: string | null;
  scopeLabel: string | null;
  number: string | null;
  period: string | null;
  issuedAt: Date | null;
  expiresAt: Date | null;
  /** Validade escrita ou estimada pela validade padrão do tipo. */
  effectiveExpiresAt: Date | null;
  isExpiryEstimated: boolean;
  daysToExpire: number | null;
  status: string;
  displayStatus: CompanyDocumentDisplayStatus;
  hasExtraction: boolean;
  isFromCertificate: boolean;
  file: { nboxItemId: string; name: string; mimeType: string | null; size: number | null } | null;
  createdAt: Date;
}

function resolveDisplayStatus(status: string, daysToExpire: number | null): CompanyDocumentDisplayStatus {
  if (status === "REPLACED") return "REPLACED";
  if (status === "PENDING_REVIEW") return "PENDING_REVIEW";
  if (daysToExpire === null) return "VALID";
  if (daysToExpire < 0) return "EXPIRED";
  if (daysToExpire <= EXPIRING_SOON_DAYS) return "EXPIRING_SOON";
  return "VALID";
}

function readCertificateId(extraction: unknown): string | null {
  if (typeof extraction !== "object" || extraction === null) return null;
  const certificateId = (extraction as { certificateId?: unknown }).certificateId;
  return typeof certificateId === "string" ? certificateId : null;
}

export async function listCompanyDocuments(organizationId: string, today: Date = new Date()): Promise<CompanyDocumentRow[]> {
  const documents = await prisma.companyDocument.findMany({
    where: { organizationId },
    orderBy: [{ status: "asc" }, { expiresAt: "asc" }, { createdAt: "desc" }],
  });

  const nboxItemIds = documents.flatMap((document) => (document.nboxItemId ? [document.nboxItemId] : []));
  const items = nboxItemIds.length
    ? await prisma.nBoxItem.findMany({
        where: { organizationId, id: { in: nboxItemIds } },
        select: { id: true, name: true, mimeType: true, size: true },
      })
    : [];
  const itemsById = new Map(items.map((item) => [item.id, item]));

  const rows = documents.map((document): CompanyDocumentRow => {
    const documentType = findDocumentType(document.typeCode);
    const validityDays = documentType?.defaultValidityDays ?? null;
    const referenceDate = document.issuedAt ?? document.createdAt;
    const estimatedExpiry =
      !document.expiresAt && validityDays !== null && documentType?.recurrence !== "MONTHLY"
        ? new Date(referenceDate.getTime() + validityDays * DAY_MS)
        : null;
    const effectiveExpiresAt = document.expiresAt ?? estimatedExpiry;
    const daysToExpire = effectiveExpiresAt
      ? Math.floor((effectiveExpiresAt.getTime() - today.getTime()) / DAY_MS)
      : null;
    const item = document.nboxItemId ? itemsById.get(document.nboxItemId) : undefined;

    return {
      id: document.id,
      typeCode: document.typeCode,
      typeLabel:
        document.typeCode === CUSTOM_DOCUMENT_TYPE
          ? document.label ?? "Documento avulso"
          : documentType?.label ?? document.typeCode,
      groupLabel: documentType ? DOCUMENT_GROUP_LABELS[documentType.group] : null,
      scopeLabel: documentType ? DOCUMENT_SCOPE_LABELS[documentType.scope] : null,
      number: document.number,
      period: document.period,
      issuedAt: document.issuedAt,
      expiresAt: document.expiresAt,
      effectiveExpiresAt,
      isExpiryEstimated: !document.expiresAt && !!estimatedExpiry,
      daysToExpire,
      status: document.status,
      displayStatus: resolveDisplayStatus(document.status, daysToExpire),
      hasExtraction: isStoredCompanyDocumentExtraction(document.extraction),
      isFromCertificate: readCertificateId(document.extraction) !== null,
      file: item ? { nboxItemId: item.id, name: item.name, mimeType: item.mimeType, size: item.size } : null,
      createdAt: document.createdAt,
    };
  });

  const statusOrder: Record<CompanyDocumentDisplayStatus, number> = {
    PENDING_REVIEW: 0,
    EXPIRED: 1,
    EXPIRING_SOON: 2,
    VALID: 3,
    REPLACED: 4,
  };
  return rows.sort(
    (left, right) =>
      statusOrder[left.displayStatus] - statusOrder[right.displayStatus] ||
      (left.effectiveExpiresAt?.getTime() ?? Number.MAX_SAFE_INTEGER) -
        (right.effectiveExpiresAt?.getTime() ?? Number.MAX_SAFE_INTEGER) ||
      right.createdAt.getTime() - left.createdAt.getTime(),
  );
}

export async function listRequirementApplicability(
  organizationId: string,
): Promise<Array<{ typeCode: string; isApplicable: boolean }>> {
  const requirements = await prisma.companyDocumentRequirement.findMany({
    where: { organizationId, isApplicable: { not: null } },
    select: { typeCode: true, isApplicable: true },
  });
  return requirements.flatMap((requirement) =>
    requirement.isApplicable === null ? [] : [{ typeCode: requirement.typeCode, isApplicable: requirement.isApplicable }],
  );
}
