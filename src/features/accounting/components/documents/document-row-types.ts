import type { DocumentDisplayStatus } from "./document-display";

/** Linha de `accounting.documents.list` como o cliente recebe. */
export interface CompanyDocumentRowView {
  id: string;
  typeCode: string;
  typeLabel: string;
  groupLabel: string | null;
  scopeLabel: string | null;
  number: string | null;
  period: string | null;
  issuedAt: Date | string | null;
  expiresAt: Date | string | null;
  effectiveExpiresAt: Date | string | null;
  isExpiryEstimated: boolean;
  daysToExpire: number | null;
  status: string;
  displayStatus: DocumentDisplayStatus;
  hasExtraction: boolean;
  isFromCertificate: boolean;
  file: { nboxItemId: string; name: string; mimeType: string | null; size: number | null } | null;
}
