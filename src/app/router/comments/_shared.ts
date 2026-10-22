import { ORPCError } from "@orpc/server";
import prisma from "@/lib/prisma";
import { resolvePublicOrigin } from "@/lib/public-origin";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { isDomainError } from "@/modules/shared/domain/domain-error";
import { SocialErrorCode } from "@/modules/social/domain/errors";
import { socialRepositoriesForOrganization } from "@/modules/social";

export const commentsProcedure = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware);

export function repositoriesFor(organizationId: string) {
  return socialRepositoriesForOrganization(organizationId);
}

const FULL_ACCESS_ROLES = new Set(["owner", "admin"]);

/**
 * Conectar e desconectar mexem em credencial — ficam restritos a owner/admin.
 * Ler e editar automação segue liberado para qualquer membro.
 */
export async function isOrgAdmin(
  organizationId: string,
  userId: string,
): Promise<boolean> {
  const member = await prisma.member.findFirst({
    where: { organizationId, userId },
    select: { role: true },
  });
  return Boolean(member && FULL_ACCESS_ROLES.has(member.role));
}

export async function requireOrgAdmin(
  organizationId: string,
  userId: string,
): Promise<void> {
  if (!(await isOrgAdmin(organizationId, userId))) {
    throw new ORPCError("FORBIDDEN", {
      message: "Apenas owner ou admin podem gerenciar a conexão.",
    });
  }
}

export async function requireOrgMember(organizationId: string, userId: string): Promise<void> {
  const member = await prisma.member.findFirst({ where: { organizationId, userId }, select: { id: true } });
  if (!member) throw new ORPCError("FORBIDDEN", { message: "Você não faz parte desta empresa." });
}

const STATUS_BY_CODE: Record<string, "NOT_FOUND" | "FORBIDDEN" | "BAD_REQUEST" | "CONFLICT"> = {
  [SocialErrorCode.AUTOMATION_NOT_FOUND]: "NOT_FOUND",
  [SocialErrorCode.CHANNEL_NOT_CONNECTED]: "BAD_REQUEST",
  [SocialErrorCode.CHANNEL_NEEDS_RECONNECT]: "BAD_REQUEST",
  [SocialErrorCode.CHANNEL_ALREADY_TAKEN]: "CONFLICT",
  [SocialErrorCode.CHANNEL_NOT_FOUND]: "NOT_FOUND",
  [SocialErrorCode.CHANNEL_LIMIT_REACHED]: "BAD_REQUEST",
  [SocialErrorCode.AUTOMATION_INCOMPLETE]: "BAD_REQUEST",
  [SocialErrorCode.INVALID_CREDENTIALS]: "BAD_REQUEST",
  [SocialErrorCode.INVALID_STEP_CONFIG]: "BAD_REQUEST",
};

/**
 * Traduz erro de domínio para o protocolo do adapter. O domínio não conhece
 * HTTP; é aqui que `CHANNEL_ALREADY_TAKEN` vira 409.
 *
 * Note o `throw errors.X({...})` COM parênteses: sem eles o oRPC lança a
 * função e tudo vira 500 — bug que a auditoria contou 228 vezes no repo.
 */
export async function withDomainErrors<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (isDomainError(error)) {
      const status = STATUS_BY_CODE[error.code] ?? "BAD_REQUEST";
      throw new ORPCError(status, { message: error.message });
    }
    throw error;
  }
}

export function webhookUrlFor(
  provider: string,
  webhookPathToken: string,
  headers?: Headers,
): string {
  return `${resolvePublicOrigin(headers)}/api/social/webhook/${provider.toLowerCase()}/${webhookPathToken}`;
}
