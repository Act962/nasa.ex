import "server-only";

import prisma from "@/lib/prisma";
import { decryptSecret, encryptSecret, last4 } from "@/lib/crypto";

// Cofre de senhas de portais (e-CAC, SEFAZ, prefeitura...). O segredo só
// existe cifrado (AES-256-GCM); a listagem nunca o devolve.

export interface CompanyCredentialInput {
  portal: string;
  label: string;
  username: string | null;
  url: string | null;
  notes: string | null;
}

export async function listCompanyCredentials(organizationId: string) {
  const credentials = await prisma.companyCredential.findMany({
    where: { organizationId },
    orderBy: [{ portal: "asc" }, { label: "asc" }],
    select: {
      id: true,
      portal: true,
      label: true,
      username: true,
      secretLast4: true,
      url: true,
      notes: true,
      updatedAt: true,
      _count: { select: { reveals: true } },
      reveals: { orderBy: { revealedAt: "desc" }, take: 1, select: { revealedAt: true } },
    },
  });
  return credentials.map((credential) => ({
    id: credential.id,
    portal: credential.portal,
    label: credential.label,
    username: credential.username,
    secretLast4: credential.secretLast4,
    url: credential.url,
    notes: credential.notes,
    updatedAt: credential.updatedAt,
    revealCount: credential._count.reveals,
    lastRevealedAt: credential.reveals[0]?.revealedAt ?? null,
  }));
}

export async function createCompanyCredential(params: {
  organizationId: string;
  userId: string;
  data: CompanyCredentialInput;
  secret: string;
}) {
  return prisma.companyCredential.create({
    data: {
      organizationId: params.organizationId,
      createdById: params.userId,
      ...params.data,
      secretEncrypted: encryptSecret(params.secret),
      secretLast4: last4(params.secret),
    },
    select: { id: true },
  });
}

/** `secret` ausente mantém a senha atual. */
export async function updateCompanyCredential(params: {
  organizationId: string;
  credentialId: string;
  data: Partial<CompanyCredentialInput>;
  secret?: string;
}): Promise<boolean> {
  const result = await prisma.companyCredential.updateMany({
    where: { id: params.credentialId, organizationId: params.organizationId },
    data: {
      ...params.data,
      ...(params.secret ? { secretEncrypted: encryptSecret(params.secret), secretLast4: last4(params.secret) } : {}),
    },
  });
  return result.count > 0;
}

export async function deleteCompanyCredential(organizationId: string, credentialId: string): Promise<boolean> {
  const result = await prisma.companyCredential.deleteMany({ where: { id: credentialId, organizationId } });
  return result.count > 0;
}

/** Decifra e registra quem viu. Chame só depois do step-up verificado. */
export async function revealCompanyCredential(params: {
  organizationId: string;
  credentialId: string;
  userId: string;
}): Promise<{ secret: string; label: string; portal: string } | null> {
  const credential = await prisma.companyCredential.findFirst({
    where: { id: params.credentialId, organizationId: params.organizationId },
    select: { id: true, secretEncrypted: true, label: true, portal: true },
  });
  if (!credential) return null;
  const secret = decryptSecret(credential.secretEncrypted);
  await prisma.companyCredentialRevealLog.create({
    data: { credentialId: credential.id, organizationId: params.organizationId, userId: params.userId },
  });
  return { secret, label: credential.label, portal: credential.portal };
}
