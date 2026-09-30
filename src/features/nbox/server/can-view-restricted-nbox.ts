import "server-only";

import prisma from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import {
  ensureOrgOwnerPaymentAccess,
  type PaymentAccessActor,
} from "@/features/payment/server/ensure-payment-access";

// Pastas restritas do N-Box (spec 0051) guardam documentos da empresa e só
// aparecem para quem é ADMIN/OWNER do financeiro — a mesma regra do cofre da
// aba Contábil, para que N-Box e Payment nunca discordem sobre quem vê o quê.

const RESTRICTED_VIEWER_ROLES = new Set(["ADMIN", "OWNER"]);

export async function canViewRestrictedNBox(actor: PaymentAccessActor, organizationId: string): Promise<boolean> {
  const access = await ensureOrgOwnerPaymentAccess(actor, organizationId);
  return !!access?.isAuthorized && RESTRICTED_VIEWER_ROLES.has(access.role);
}

export interface FolderRestriction {
  id: string;
  isRestricted: boolean;
  systemKey: string | null;
}

export async function loadFolderRestriction(
  folderId: string | null | undefined,
  organizationId: string,
): Promise<FolderRestriction | null> {
  if (!folderId) return null;
  return prisma.nBoxFolder.findFirst({
    where: { id: folderId, organizationId },
    select: { id: true, isRestricted: true, systemKey: true },
  });
}

/** Filtro Prisma de item fora de pasta restrita (itens na raiz contam como livres). */
export const UNRESTRICTED_ITEM_FILTER: Prisma.NBoxItemWhereInput = {
  OR: [{ folderId: null }, { folder: { isRestricted: false } }],
};

export async function isItemInRestrictedFolder(itemId: string, organizationId: string): Promise<boolean> {
  const item = await prisma.nBoxItem.findFirst({
    where: { id: itemId, organizationId },
    select: { folder: { select: { isRestricted: true } } },
  });
  return item?.folder?.isRestricted === true;
}

/** Arquivo que é o original de um documento da aba Contábil — só sai por lá. */
export async function isCompanyDocumentFile(itemId: string, organizationId: string): Promise<boolean> {
  const linkedDocument = await prisma.companyDocument.findFirst({
    where: { nboxItemId: itemId, organizationId },
    select: { id: true },
  });
  return !!linkedDocument;
}
