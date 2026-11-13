import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { ORPCError } from "@orpc/server";
import prisma from "@/lib/prisma";
import { assertPlannerOrganizationAccess, type PlannerAction } from "@/features/nasa-planner/server/cross-org";

/** Chaves de acesso de IA externa ao MCP do ÓRBITA (spec 0065, RF-1/RF-2). Só o hash vai para o banco. */

const TOKEN_PREFIX = "orb_live_";
const VISIBLE_PREFIX_LENGTH = TOKEN_PREFIX.length + 4;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export const PLANNER_SCOPE = "planner";
export const TRAFEGO_SCOPE = "trafego";
/** Fluxos do FlowAstro (spec 0142). Só chave criada depois dele: chave antiga não ganha poder sem ser recriada. */
export const FLOWASTRO_SCOPE = "flowastro";
/** Cards do Workspace (spec 0143). Mesma regra: só chave criada depois dele. */
export const WORKSPACE_SCOPE = "workspace";
/** Financeiro (spec 0144). Mesma regra: só chave criada depois dele. */
export const FINANCE_SCOPE = "financeiro";

/** Começo de toda chave do ÓRBITA; o que não começa assim é tratado como token OAuth (spec 0135, CB-11). */
export const isAccessKeyToken = (token: string) => token.startsWith(TOKEN_PREFIX);

/** Escopo do trafeGO é só da equipe: o dono da chave precisa ser admin do sistema (spec 0131, RF-1, RF-2). */
export async function isSystemAdmin(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { isSystemAdmin: true } });
  return user?.isSystemAdmin === true;
}

export async function createExternalAiToken(input: {
  userId: string;
  label: string;
  organizationIds: string[];
  includeTrafego?: boolean;
}) {
  if (input.organizationIds.length === 0) throw new ORPCError("BAD_REQUEST", { message: "Escolha ao menos uma empresa." });
  if (input.includeTrafego && !(await isSystemAdmin(input.userId))) {
    throw new ORPCError("FORBIDDEN", { message: "Só a equipe do ÓRBITA pode incluir as ferramentas do trafeGO." });
  }
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
      scopes: input.includeTrafego
        ? [PLANNER_SCOPE, FLOWASTRO_SCOPE, WORKSPACE_SCOPE, FINANCE_SCOPE, TRAFEGO_SCOPE]
        : [PLANNER_SCOPE, FLOWASTRO_SCOPE, WORKSPACE_SCOPE, FINANCE_SCOPE],
    },
    select: { id: true },
  });
  return { tokenId: created.id, token };
}

export async function listExternalAiTokens(userId: string) {
  const tokens = await prisma.externalAiAccessToken.findMany({
    where: { createdById: userId, revokedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, label: true, tokenPrefix: true, organizationIds: true, scopes: true, lastUsedAt: true, createdAt: true },
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
  /** Chave colada ou IA conectada por OAuth (spec 0135, D-5). */
  credential: "key" | "oauth";
  /** Id da chave ou `clientId` da IA. */
  tokenId: string;
  /** Nome da chave ou nome que a IA registrou: vira o `sourceActorLabel` dos posts. */
  label: string;
  userId: string;
  organizationIds: string[];
  /** Apps do MCP liberados (chaves de `MCP_APPS`). */
  scopes: string[];
}

export const readBearerToken = (authorizationHeader: string | null) => authorizationHeader?.match(/^Bearer\s+(\S+)$/i)?.[1] ?? null;

/** Confere a chave `orb_live_`. Devolve null quando a chave não existe ou foi revogada. */
export async function authenticateExternalAiToken(token: string): Promise<ExternalAiCaller | null> {
  if (!isAccessKeyToken(token)) return null;
  const accessToken = await prisma.externalAiAccessToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true, label: true, createdById: true, organizationIds: true, scopes: true, revokedAt: true },
  });
  if (!accessToken || accessToken.revokedAt) return null;
  await prisma.externalAiAccessToken.update({ where: { id: accessToken.id }, data: { lastUsedAt: new Date() } }).catch(() => undefined);
  return {
    credential: "key",
    tokenId: accessToken.id,
    label: accessToken.label,
    userId: accessToken.createdById,
    organizationIds: accessToken.organizationIds,
    scopes: accessToken.scopes,
  };
}

const PLANNER_ACTION_LABEL: Record<PlannerAction, string> = { view: "ver", create: "criar", approve: "aprovar", schedule: "programar e publicar" };

/** Empresa liberada na chave + permissão atual do dono no Planner dela (RNF-2). */
export async function assertCallerOrganization(caller: ExternalAiCaller, organizationId: string, action: PlannerAction) {
  if (!caller.organizationIds.includes(organizationId)) {
    throw new Error("Empresa não liberada para esta conexão. Use list_clients para ver as empresas permitidas.");
  }
  try {
    await assertPlannerOrganizationAccess(caller.userId, organizationId, action);
  } catch {
    throw new Error(`Esta conta não tem permissão para ${PLANNER_ACTION_LABEL[action]} no Planner desta empresa. Peça a um Master para liberar em Permissões.`);
  }
}
