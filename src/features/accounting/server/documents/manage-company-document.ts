import "server-only";

import prisma from "@/lib/prisma";
import { deleteStoredObject } from "@/lib/s3-client";
import { findDocumentType } from "@/features/accounting/lib/compliance/document-catalog";
import { ensureCompanyDocumentsFolder } from "@/features/accounting/server/nbox/ensure-company-documents-folder";
import {
  CUSTOM_DOCUMENT_TYPE,
  afterCompanyDocumentChange,
  replacePreviousDocuments,
  restoreLatestReplacedDocument,
} from "./document-lifecycle";

export interface ConfirmCompanyDocumentInput {
  organizationId: string;
  userId: string;
  documentId: string;
  typeCode: string;
  label: string | null;
  number: string | null;
  issuedAt: Date | null;
  expiresAt: Date | null;
  period: string | null;
}

export type ManageDocumentResult = { ok: true } | { ok: false; reason: "not_found" | "invalid"; message: string };

/** Confirma o que a IA leu (ou o que o dono corrigiu): o documento passa a valer. */
export async function confirmCompanyDocument(input: ConfirmCompanyDocumentInput): Promise<ManageDocumentResult> {
  const document = await prisma.companyDocument.findFirst({
    where: { id: input.documentId, organizationId: input.organizationId },
    select: { id: true, nboxItemId: true },
  });
  if (!document) return { ok: false, reason: "not_found", message: "Documento não encontrado." };

  const documentType = findDocumentType(input.typeCode);
  if (!documentType && input.typeCode !== CUSTOM_DOCUMENT_TYPE) {
    return { ok: false, reason: "invalid", message: "Tipo de documento desconhecido." };
  }
  if (documentType?.recurrence === "MONTHLY" && !input.period) {
    return { ok: false, reason: "invalid", message: "Informe o mês de referência deste documento." };
  }
  if (input.issuedAt && input.expiresAt && input.expiresAt.getTime() < input.issuedAt.getTime()) {
    return { ok: false, reason: "invalid", message: "A validade não pode ser antes da emissão." };
  }

  // Tipo trocado na revisão: o arquivo muda para a subpasta do grupo certo.
  const folders = document.nboxItemId ? await ensureCompanyDocumentsFolder(input.organizationId, input.userId) : null;
  const targetFolderId = folders
    ? documentType
      ? folders.folderIdByGroup[documentType.group]
      : folders.rootFolderId
    : null;

  await prisma.$transaction(async (tx) => {
    await tx.companyDocument.update({
      where: { id: document.id },
      data: {
        typeCode: input.typeCode,
        label: input.typeCode === CUSTOM_DOCUMENT_TYPE ? input.label : null,
        number: input.number,
        issuedAt: input.issuedAt,
        expiresAt: input.expiresAt,
        period: documentType?.recurrence === "MONTHLY" ? input.period : null,
        status: "VALID",
      },
    });
    await replacePreviousDocuments(tx, {
      organizationId: input.organizationId,
      typeCode: input.typeCode,
      keepDocumentId: document.id,
      period: documentType?.recurrence === "MONTHLY" ? input.period : null,
    });
    if (document.nboxItemId && targetFolderId) {
      await tx.nBoxItem.update({
        where: { id: document.nboxItemId },
        data: { folderId: targetFolderId, description: documentType?.label ?? input.label },
      });
    }
  });

  await afterCompanyDocumentChange(input.organizationId);
  return { ok: true };
}

/** Apaga registro, item do N-Box e objeto no storage (este por último, best-effort). */
export async function deleteCompanyDocument(params: {
  organizationId: string;
  documentId: string;
}): Promise<ManageDocumentResult & { fileName?: string | null; typeCode?: string }> {
  const document = await prisma.companyDocument.findFirst({
    where: { id: params.documentId, organizationId: params.organizationId },
    select: { id: true, typeCode: true, nboxItemId: true },
  });
  if (!document) return { ok: false, reason: "not_found", message: "Documento não encontrado." };

  const item = document.nboxItemId
    ? await prisma.nBoxItem.findFirst({
        where: { id: document.nboxItemId, organizationId: params.organizationId },
        select: { id: true, url: true, name: true },
      })
    : null;

  await prisma.$transaction(async (tx) => {
    await tx.companyDocument.delete({ where: { id: document.id } });
    if (item) await tx.nBoxItem.delete({ where: { id: item.id } });
    await restoreLatestReplacedDocument(tx, { organizationId: params.organizationId, typeCode: document.typeCode });
  });

  if (item?.url && !item.url.startsWith("http")) await deleteStoredObject(item.url);
  await afterCompanyDocumentChange(params.organizationId);
  return { ok: true, fileName: item?.name ?? null, typeCode: document.typeCode };
}
