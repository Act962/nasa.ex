// Builders de dados de teste: criam o mínimo válido no banco, com sobrescrita pontual.

import { randomUUID } from "node:crypto";
import { testPrisma } from "./database";

const shortId = () => randomUUID().slice(0, 8);

export async function createOrganization(overrides: { name?: string; starsBalance?: number } = {}) {
  const suffix = shortId();
  return testPrisma.organization.create({
    data: {
      name: overrides.name ?? `Empresa ${suffix}`,
      slug: `empresa-${suffix}`,
      createdAt: new Date(),
      starsBalance: overrides.starsBalance ?? 0,
    },
  });
}

export async function createUser(overrides: { name?: string; email?: string } = {}) {
  const suffix = shortId();
  return testPrisma.user.create({
    data: {
      name: overrides.name ?? `Usuário ${suffix}`,
      email: overrides.email ?? `usuario-${suffix}@teste.local`,
      emailVerified: true,
    },
  });
}

/** Empresa com um membro dono: o par mínimo para qualquer teste de isolamento. */
export async function createOrganizationWithOwner() {
  const organization = await createOrganization();
  const user = await createUser();
  await testPrisma.member.create({
    data: {
      organizationId: organization.id,
      userId: user.id,
      role: "owner",
      createdAt: new Date(),
    },
  });
  return { organization, user };
}

export async function createForm(input: { organizationId: string; userId: string; name?: string }) {
  return testPrisma.form.create({
    data: {
      organizationId: input.organizationId,
      userId: input.userId,
      name: input.name ?? "Formulário de teste",
      content: "",
      shareUrl: `form-${shortId()}`,
    },
  });
}

export async function createStarPackage(overrides: { stars?: number; priceBrl?: number } = {}) {
  return testPrisma.starPackage.create({
    data: {
      stars: overrides.stars ?? 100,
      priceBrl: overrides.priceBrl ?? 49.9,
      label: "Pacote de teste",
    },
  });
}

export async function createAsaasGateway(overrides: { webhookSecret?: string | null; isActive?: boolean } = {}) {
  return testPrisma.paymentGatewayConfig.create({
    data: {
      provider: "asaas",
      secretKey: "chave-de-teste",
      webhookSecret: overrides.webhookSecret === undefined ? "token-do-webhook" : overrides.webhookSecret,
      environment: "sandbox",
      isActive: overrides.isActive ?? true,
    },
  });
}

export async function createPendingStarsPayment(input: {
  organizationId: string;
  userId: string;
  packageId: string;
  starsAmount: number;
  amountBrl: number;
  gatewayId?: string;
}) {
  return testPrisma.starsPayment.create({
    data: {
      organizationId: input.organizationId,
      userId: input.userId,
      packageId: input.packageId,
      starsAmount: input.starsAmount,
      amountBrl: input.amountBrl,
      provider: "asaas",
      gatewayId: input.gatewayId ?? null,
      status: "pending",
    },
  });
}

/** Tracking com colunas na ordem dada. Devolve as colunas indexadas pelo nome. */
export async function createTrackingWithStatuses(input: {
  organizationId: string;
  name?: string;
  statusNames: string[];
}) {
  const tracking = await testPrisma.tracking.create({
    data: { name: input.name ?? `Tracking ${shortId()}`, organizationId: input.organizationId },
  });
  const statuses: Record<string, { id: string; name: string }> = {};
  for (const [index, statusName] of input.statusNames.entries()) {
    statuses[statusName] = await testPrisma.status.create({
      data: { name: statusName, trackingId: tracking.id, order: index * 1000 },
      select: { id: true, name: true },
    });
  }
  return { tracking, statuses };
}

export async function createLead(input: {
  trackingId: string;
  statusId: string;
  name?: string;
  phone?: string | null;
  email?: string | null;
}) {
  return testPrisma.lead.create({
    data: {
      name: input.name ?? "Lead existente",
      phone: input.phone ?? null,
      email: input.email ?? null,
      trackingId: input.trackingId,
      statusId: input.statusId,
    },
  });
}

export async function createTag(input: { organizationId: string; name: string }) {
  return testPrisma.tag.create({
    data: { name: input.name, slug: `${input.name.toLowerCase()}-${shortId()}`, organizationId: input.organizationId },
  });
}

/** Formulário publicado. Com `trackingId` e `statusId`, o envio cria ou reposiciona lead. */
export async function createPublishedForm(input: {
  organizationId: string;
  userId: string;
  name?: string;
  published?: boolean;
  jsonBlock?: unknown[];
  trackingId?: string;
  statusId?: string;
  whatsappChats?: unknown[];
}) {
  const form = await testPrisma.form.create({
    data: {
      organizationId: input.organizationId,
      userId: input.userId,
      name: input.name ?? "Formulário de teste",
      content: "",
      shareUrl: `form-${shortId()}`,
      published: input.published ?? true,
      jsonBlock: JSON.stringify(input.jsonBlock ?? []),
    },
  });
  await testPrisma.formSettings.create({
    data: {
      formId: form.id,
      primaryColor: "#1447e6",
      backgroundColor: "#ffffff",
      trackingId: input.trackingId ?? null,
      statusId: input.statusId ?? null,
      whatsappChats: (input.whatsappChats ?? []) as never,
    },
  });
  return form;
}

