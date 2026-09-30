import "server-only";

import prisma from "@/lib/prisma";

export interface CompanyDocumentFile {
  fileKey: string;
  fileName: string;
  mimeType: string | null;
  nboxItemId: string;
  isCompanyDocument: boolean;
}

/**
 * Resolve o arquivo por id de CompanyDocument ou de NBoxItem. Só devolve item
 * de pasta restrita — esta rota não é atalho para o resto do N-Box.
 */
export async function resolveCompanyDocumentFile(
  id: string,
  organizationId: string,
): Promise<CompanyDocumentFile | null> {
  const document = await prisma.companyDocument.findFirst({
    where: { organizationId, OR: [{ id }, { nboxItemId: id }] },
    select: { nboxItemId: true },
  });
  const nboxItemId = document?.nboxItemId ?? id;

  const item = await prisma.nBoxItem.findFirst({
    where: { id: nboxItemId, organizationId, folder: { isRestricted: true } },
    select: { id: true, url: true, name: true, mimeType: true },
  });
  if (!item?.url || item.url.startsWith("http")) return null;

  return {
    fileKey: item.url,
    fileName: item.name,
    mimeType: item.mimeType,
    nboxItemId: item.id,
    isCompanyDocument: !!document,
  };
}
