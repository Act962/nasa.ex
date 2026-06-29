import prisma from "@/lib/prisma";
import type {
  SyncAccountPayload,
  SyncEnvelope,
  SyncMemberPayload,
  SyncOrgPayload,
  SyncUserPayload,
} from "./payloads";

/**
 * Handler compartilhado do INBOUND do sync de auth (qualquer app → NASA).
 *
 * Usado pelas rotas `/api/sync/nerp` e `/api/sync/comments` — a verificação de
 * assinatura fica na rota; aqui mora só o upsert.
 *
 * INVARIANTE: NUNCA usa APIs do better-auth — só Prisma cru. Isso garante que a
 * escrita não dispara `databaseHooks`/`organizationHooks`, ou seja, não há
 * eco/loop de replicação. Todo upsert é por `id` (idempotente).
 *
 * Retorna `{ status, body }` (não `NextResponse`) pra ser agnóstico de rota:
 *  - 200 → aplicado (ou pulado por colisão de identidade, logado).
 *  - 409 `{ retryable: true }` → pré-requisito de FK ausente. O remoto reenfileira.
 */

export type InboundResult = {
  status: number;
  body: Record<string, unknown>;
};

const OK: InboundResult = { status: 200, body: { ok: true } };

function toNullableDate(iso: string | null): Date | null {
  return iso ? new Date(iso) : null;
}

export async function applyInboundSync(
  envelope: SyncEnvelope,
  sourceApp: string,
): Promise<InboundResult> {
  switch (envelope.type) {
    case "user":
      return upsertUser(envelope.data, sourceApp);
    case "account":
      return upsertAccount(envelope.data);
    case "org":
      return upsertOrg(envelope.data);
    case "member":
      return upsertMember(envelope.data, sourceApp);
    default:
      return { status: 400, body: { error: "unknown_type" } };
  }
}

async function upsertUser(
  payload: SyncUserPayload,
  sourceApp: string,
): Promise<InboundResult> {
  // Colisão de e-mail (unique) com id diferente → loga e pula.
  const userWithSameEmail = await prisma.user.findUnique({
    where: { email: payload.email },
    select: { id: true },
  });
  if (userWithSameEmail && userWithSameEmail.id !== payload.id) {
    console.warn(
      `[sync inbound ${sourceApp}] user email collision: ${payload.email} (incoming ${payload.id} != local ${userWithSameEmail.id}) — skipping`,
    );
    return { status: 200, body: { ok: true, skipped: "email_collision" } };
  }

  const userData = {
    name: payload.name,
    email: payload.email,
    emailVerified: payload.emailVerified,
    image: payload.image,
    phone: payload.phone,
    createdAt: new Date(payload.createdAt),
    updatedAt: new Date(payload.updatedAt),
  };
  await prisma.user.upsert({
    where: { id: payload.id },
    create: { id: payload.id, ...userData },
    update: userData,
  });
  return OK;
}

async function upsertAccount(
  payload: SyncAccountPayload,
): Promise<InboundResult> {
  // Pré-requisito: o User precisa existir (FK). Se não, retryable.
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true },
  });
  if (!user) {
    return { status: 409, body: { error: "user_not_found", retryable: true } };
  }

  const accountData = {
    accountId: payload.accountId,
    providerId: payload.providerId,
    userId: payload.userId,
    accessToken: payload.accessToken,
    refreshToken: payload.refreshToken,
    idToken: payload.idToken,
    accessTokenExpiresAt: toNullableDate(payload.accessTokenExpiresAt),
    refreshTokenExpiresAt: toNullableDate(payload.refreshTokenExpiresAt),
    scope: payload.scope,
    password: payload.password,
    createdAt: new Date(payload.createdAt),
    updatedAt: new Date(payload.updatedAt),
  };
  await prisma.account.upsert({
    where: { id: payload.id },
    create: { id: payload.id, ...accountData },
    update: accountData,
  });
  return OK;
}

async function upsertOrg(payload: SyncOrgPayload): Promise<InboundResult> {
  const orgData = {
    name: payload.name,
    slug: payload.slug,
    logo: payload.logo,
    metadata: payload.metadata,
    createdAt: new Date(payload.createdAt),
  };
  await prisma.organization.upsert({
    where: { id: payload.id },
    create: { id: payload.id, ...orgData },
    update: orgData,
  });
  return OK;
}

async function upsertMember(
  payload: SyncMemberPayload,
  sourceApp: string,
): Promise<InboundResult> {
  // Pré-requisitos: org + user existem (FK). Se não, retryable.
  const [org, user] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: payload.organizationId },
      select: { id: true },
    }),
    prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true },
    }),
  ]);
  if (!org || !user) {
    return {
      status: 409,
      body: { error: "prerequisite_missing", retryable: true },
    };
  }

  // Colisão do par único [userId, organizationId] com id diferente → pula.
  const memberWithSamePair = await prisma.member.findUnique({
    where: {
      userId_organizationId: {
        userId: payload.userId,
        organizationId: payload.organizationId,
      },
    },
    select: { id: true },
  });
  if (memberWithSamePair && memberWithSamePair.id !== payload.id) {
    console.warn(
      `[sync inbound ${sourceApp}] member pair collision (incoming ${payload.id} != local ${memberWithSamePair.id}) — skipping`,
    );
    return { status: 200, body: { ok: true, skipped: "member_collision" } };
  }

  const memberData = {
    organizationId: payload.organizationId,
    userId: payload.userId,
    role: payload.role,
    createdAt: new Date(payload.createdAt),
  };
  await prisma.member.upsert({
    where: { id: payload.id },
    create: { id: payload.id, ...memberData },
    update: memberData,
  });
  return OK;
}
