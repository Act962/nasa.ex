import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { ORPCError } from "@orpc/server";
import prisma from "@/lib/prisma";
import { assertPlannerOrganizationAccess, type PlannerAction } from "@/features/nasa-planner/server/cross-org";

/** Chaves de acesso de IA externa ao MCP do ÓRBITA (spec 0065, RF-1/RF-2). Só o hash vai para o banco. */

const TOKEN_PREFIX = "orb_live_";
const VISIBLE_PREFIX_LENGTH = TOKEN_PREFIX.length + 4;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createExternalAiToken(input: { userId: string; label: string; organizationIds: string[] }) {
  if (input.organizationIds.length === 0) throw new ORPCError("BAD_REQUEST", { message: "Escolha ao menos uma empresa." });
  for (const organizationId of input.organizationIds) {
    await assertPlannerOrganizationAccess(input.userId, organizationId, "create");
  }
  const token = `${TOKEN_PREFIX}${randomBytes(24).toString("base64url")}`;
  const created = await prisma.externalAiAccessToken.create({
    data: {
      createdById: input.userId,
      label: input.label,
      tokenHash: hashToken(token),
      tokenPrefix: token.slice(0, VISIBLE_PREFIX_LENGTH),
      organizationIds: input.organizationIds,
    },
    select: { id: true },
  });
  return { tokenId: created.id, token };
}

export async function listExternalAiTokens(userId: string) {
  const tokens = await prisma.externalAiAccessToken.findMany({
    where: { createdById: userId, revokedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, label: true, tokenPrefix: true, organizationIds: true, lastUsedAt: true, createdAt: true },
  });
  const organizationIds = [...new Set(tokens.flatMap((token) => token.organizationIds))];
  const organizations = await prisma.organization.findMany({ where: { id: { in: organizationIds } }, select: { id: true, name: true } });
  const nameById = new Map(organizations.map((organization) => [organization.id, organization.name]));
  return tokens.map((token) => ({ ...token, organizationNames: token.organizationIds.map((organizationId) => nameById.get(organizationId) ?? "empresa removida") }));
}

export async function revokeExternalAiToken(userId: string, tokenId: string) {
  await prisma.externalAiAccessToken.updateMany({ where: { id: tokenId, createdById: userId, revokedAt: null }, data: { revokedAt: new Date() } });
}

export interface ExternalAiCaller {
  tokenId: string;
  label: string;
  userId: string;
  organizationIds: string[];
}

/** Confere o Bearer. Devolve null quando a chave não existe ou foi revogada. */
export async function authenticateExternalAiToken(authorizationHeader: string | null): Promise<ExternalAiCaller | null> {
  const token = authorizationHeader?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token?.startsWith(TOKEN_PREFIX)) return null;
  const accessToken = await prisma.externalAiAccessToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true, label: true, createdById: true, organizationIds: true, revokedAt: true },
  });
  if (!accessToken || accessToken.revokedAt) return null;
  await prisma.externalAiAccessToken.update({ where: { id: accessToken.id }, data: { lastUsedAt: new Date() } }).catch(() => undefined);
  return { tokenId: accessToken.id, label: accessToken.label, userId: accessToken.createdById, organizationIds: accessToken.organizationIds };
}

/** Empresa liberada na chave + permissão atual do dono no Planner dela (RNF-2). */
export async function assertCallerOrganization(caller: ExternalAiCaller, organizationId: string, action: PlannerAction) {
  if (!caller.organizationIds.includes(organizationId)) {
    throw new Error("Empresa não liberada para esta chave. Use list_clients para ver as empresas permitidas.");
  }
  try {
    await assertPlannerOrganizationAccess(caller.userId, organizationId, action);
  } catch {
    throw new Error("O dono desta chave não tem mais permissão no Planner desta empresa.");
  }
}
