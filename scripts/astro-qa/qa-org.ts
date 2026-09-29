import prisma from "../../src/lib/prisma";

// A bateria só escreve nesta org. Tudo que apaga passa por `assertQaOrg`.

export const QA_ORG_SLUG = "astro-qa";
export const QA_ORG_NAME = "ASTRO QA";

export interface QaOrgContext {
  organizationId: string;
  ownerUserId: string;
  /** Persona "Vendedor" (papel member, sem acesso ao Financeiro). */
  sellerUserId: string;
}

// Usuário só de teste: sem conta de login (nenhuma senha), e-mail em domínio
// que não existe. Serve às personas das fases F2, F5 e F7.
export const QA_SELLER_EMAIL = "vendedor.qa@astro-qa.invalid";
export const QA_SELLER_NAME = "Vendedor QA";

async function ensureSeller(organizationId: string): Promise<string> {
  const seller = await prisma.user.upsert({
    where: { email: QA_SELLER_EMAIL },
    create: { name: QA_SELLER_NAME, email: QA_SELLER_EMAIL, emailVerified: false },
    update: {},
    select: { id: true },
  });
  await prisma.member.upsert({
    where: { userId_organizationId: { userId: seller.id, organizationId } },
    create: { organizationId, userId: seller.id, role: "member", cargo: "Vendedor", createdAt: new Date() },
    update: {},
  });
  return seller.id;
}

export async function loadQaOrg(): Promise<QaOrgContext> {
  const organization = await prisma.organization.findUnique({
    where: { slug: QA_ORG_SLUG },
    select: {
      id: true,
      members: { where: { role: { contains: "owner" } }, select: { userId: true }, take: 1 },
    },
  });
  const owner = organization?.members[0];
  if (!organization || !owner) {
    throw new Error(
      `Org de QA "${QA_ORG_SLUG}" não existe. Rode antes: pnpm tsx --conditions=react-server scripts/astro-qa/seed.ts --owner <email>`,
    );
  }
  const sellerUserId = await ensureSeller(organization.id);
  return { organizationId: organization.id, ownerUserId: owner.userId, sellerUserId };
}

export async function assertQaOrg(organizationId: string): Promise<void> {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { slug: true },
  });
  if (organization?.slug !== QA_ORG_SLUG) {
    throw new Error(`Recusado: ${organizationId} não é a org de QA.`);
  }
}
