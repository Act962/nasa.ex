import "server-only";

import prisma from "@/lib/prisma";
import {
  DOCUMENT_GROUP_LABELS,
  type DocumentGroup,
} from "@/features/accounting/lib/compliance/document-catalog";

// Pasta "Documentos da empresa" do N-Box (spec 0051): criada pelo sistema,
// restrita a ADMIN/OWNER do financeiro, com uma subpasta por grupo do catálogo.

export const COMPANY_DOCUMENTS_ROOT_KEY = "company_documents";
const COMPANY_DOCUMENTS_COLOR = "#8B5CF6";

export function companyDocumentsGroupKey(group: DocumentGroup): string {
  return `${COMPANY_DOCUMENTS_ROOT_KEY}:${group}`;
}

export interface CompanyDocumentsFolders {
  rootFolderId: string;
  folderIdByGroup: Record<DocumentGroup, string>;
}

/**
 * Idempotente: upsert por (organizationId, systemKey). Duas abas abrindo juntas
 * podem colidir na unique no primeiro acesso — a segunda tentativa só lê.
 */
export async function ensureCompanyDocumentsFolder(
  organizationId: string,
  userId: string,
): Promise<CompanyDocumentsFolders> {
  try {
    return await upsertCompanyDocumentsFolders(organizationId, userId);
  } catch {
    return upsertCompanyDocumentsFolders(organizationId, userId);
  }
}

async function upsertCompanyDocumentsFolders(
  organizationId: string,
  userId: string,
): Promise<CompanyDocumentsFolders> {
  const root = await prisma.nBoxFolder.upsert({
    where: { organizationId_systemKey: { organizationId, systemKey: COMPANY_DOCUMENTS_ROOT_KEY } },
    create: {
      organizationId,
      systemKey: COMPANY_DOCUMENTS_ROOT_KEY,
      name: "Documentos da empresa",
      color: COMPANY_DOCUMENTS_COLOR,
      isRestricted: true,
      createdById: userId,
    },
    update: { isRestricted: true },
    select: { id: true },
  });

  const groups = Object.keys(DOCUMENT_GROUP_LABELS) as DocumentGroup[];
  const groupFolders = await Promise.all(
    groups.map((group) =>
      prisma.nBoxFolder.upsert({
        where: { organizationId_systemKey: { organizationId, systemKey: companyDocumentsGroupKey(group) } },
        create: {
          organizationId,
          systemKey: companyDocumentsGroupKey(group),
          name: DOCUMENT_GROUP_LABELS[group],
          color: COMPANY_DOCUMENTS_COLOR,
          parentId: root.id,
          isRestricted: true,
          createdById: userId,
        },
        update: { isRestricted: true, parentId: root.id },
        select: { id: true },
      }),
    ),
  );

  const folderIdByGroup = Object.fromEntries(
    groups.map((group, index) => [group, groupFolders[index].id]),
  ) as Record<DocumentGroup, string>;

  return { rootFolderId: root.id, folderIdByGroup };
}
