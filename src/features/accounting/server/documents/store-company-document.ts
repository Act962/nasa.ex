import "server-only";

import { Upload } from "@aws-sdk/lib-storage";
import { v4 as uuidv4 } from "uuid";
import prisma from "@/lib/prisma";
import { S3, deleteStoredObject } from "@/lib/s3-client";
import { NBoxItemType } from "@/generated/prisma/enums";
import { logActivity } from "@/features/admin/lib/activity-logger";
import { findDocumentType } from "@/features/accounting/lib/compliance/document-catalog";
import { ensureCompanyDocumentsFolder } from "@/features/accounting/server/nbox/ensure-company-documents-folder";
import {
  CUSTOM_DOCUMENT_TYPE,
  afterCompanyDocumentChange,
  replacePreviousDocuments,
  resolveUploadStatus,
} from "./document-lifecycle";
import type { AuthorizedAccountingRequest } from "./authorize-accounting-request";

export const MAX_COMPANY_DOCUMENT_BYTES = 15 * 1024 * 1024;

const EXTENSION_BY_MIME: Record<string, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "application/xml": "xml",
  "text/xml": "xml",
};

/** Navegador às vezes manda XML como octet-stream; a extensão desempata. */
export function resolveCompanyDocumentMime(file: { type: string; name: string }): string | null {
  if (EXTENSION_BY_MIME[file.type]) return file.type;
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith(".xml")) return "application/xml";
  if (lowerName.endsWith(".pdf")) return "application/pdf";
  return null;
}

export interface StoreCompanyDocumentInput {
  actor: AuthorizedAccountingRequest;
  file: File;
  mimeType: string;
  typeCode: string;
  label: string | null;
  period: string | null;
  issuedAt: Date | null;
  expiresAt: Date | null;
  number: string | null;
}

export async function storeCompanyDocument(input: StoreCompanyDocumentInput) {
  const { actor } = input;
  const folders = await ensureCompanyDocumentsFolder(actor.organizationId, actor.userId);
  const documentType = findDocumentType(input.typeCode);
  const folderId = documentType ? folders.folderIdByGroup[documentType.group] : folders.rootFolderId;

  const extension = EXTENSION_BY_MIME[input.mimeType] ?? "bin";
  const fileKey = `accounting/${actor.organizationId}/documents/${uuidv4()}.${extension}`;

  await new Upload({
    client: S3,
    params: {
      Bucket: process.env.NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES!,
      Key: fileKey,
      Body: Buffer.from(await input.file.arrayBuffer()),
      ContentType: input.mimeType,
    },
    queueSize: 4,
    partSize: 5 * 1024 * 1024,
  }).done();

  const status = resolveUploadStatus(input.typeCode, !!(input.issuedAt || input.expiresAt));

  let document;
  try {
    document = await prisma.$transaction(async (tx) => {
      const nboxItem = await tx.nBoxItem.create({
        data: {
          organizationId: actor.organizationId,
          folderId,
          type: input.mimeType.startsWith("image/") ? NBoxItemType.IMAGE : NBoxItemType.FILE,
          name: input.file.name,
          url: fileKey,
          mimeType: input.mimeType,
          size: input.file.size,
          description: documentType?.label ?? input.label ?? null,
          tags: ["documentos-da-empresa"],
          createdById: actor.userId,
        },
        select: { id: true },
      });
      const created = await tx.companyDocument.create({
        data: {
          organizationId: actor.organizationId,
          typeCode: input.typeCode,
          label: input.typeCode === CUSTOM_DOCUMENT_TYPE ? input.label : null,
          nboxItemId: nboxItem.id,
          number: input.number,
          issuedAt: input.issuedAt,
          expiresAt: input.expiresAt,
          period: input.period,
          status,
          uploadedById: actor.userId,
        },
        select: { id: true, typeCode: true, status: true, period: true },
      });
      if (status === "VALID") {
        await replacePreviousDocuments(tx, {
          organizationId: actor.organizationId,
          typeCode: input.typeCode,
          keepDocumentId: created.id,
          period: input.period,
        });
      }
      return created;
    });
  } catch (error) {
    await deleteStoredObject(fileKey);
    throw error;
  }

  await logActivity({
    organizationId: actor.organizationId,
    userId: actor.userId,
    userName: actor.userName,
    userEmail: actor.userEmail,
    userImage: actor.userImage,
    appSlug: "payment",
    subAppSlug: "payment-accounting",
    action: "accounting.document.uploaded",
    actionLabel: `Enviou o documento "${documentType?.label ?? input.label ?? input.file.name}"`,
    resource: input.file.name,
    resourceId: document.id,
    metadata: { typeCode: input.typeCode, period: input.period, status },
  });
  await afterCompanyDocumentChange(actor.organizationId);

  return document;
}
