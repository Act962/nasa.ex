import prisma from "@/lib/prisma";

/**
 * Resultado de checagem de autorização do user pra usar Astro Meta Ads via MCP.
 *
 * - `role`: o user é owner ou moderador (autorização IMPLÍCITA)
 * - `explicit`: o user é admin/member com `MetaMcpAuthorization` válida
 * - `no_grant`: user é admin/member SEM grant
 * - `revoked`: tinha grant mas foi revogado
 * - `not_member`: user não pertence à org (caso raro de query inconsistente)
 * - `mcp_disabled`: a integração Meta MCP não foi habilitada na org
 */
export type AuthorizationResult =
  | { authorized: true; reason: "role" | "explicit" }
  | {
      authorized: false;
      reason: "no_grant" | "revoked" | "not_member" | "mcp_disabled";
    };

/**
 * Checa se um user pode usar Meta MCP numa dada organização.
 *
 * Regras:
 *  1. MCP precisa estar habilitado na org (`PlatformIntegration.config.mcpEnabled`)
 *  2. Owner e Moderador → autorizados implicitamente pelo role
 *  3. Admin e Member → precisam de `MetaMcpAuthorization` ativa (sem `revokedAt`)
 *
 * Chamada como primeira linha de cada tool Meta MCP e antes de
 * `executeMcpAction` no backend.
 */
export async function checkMcpAuthorization(
  userId: string,
  organizationId: string,
): Promise<AuthorizationResult> {
  // 1. Integração Meta da org tem MCP habilitado?
  const integration = await prisma.platformIntegration.findUnique({
    where: { organizationId_platform: { organizationId, platform: "META" } },
    select: { config: true, isActive: true },
  });
  const config = (integration?.config ?? {}) as Record<string, unknown>;
  if (!integration?.isActive || config.mcpEnabled !== true) {
    return { authorized: false, reason: "mcp_disabled" };
  }

  // 2. Membership + role-based check
  const member = await prisma.member.findFirst({
    where: { userId, organizationId },
    select: { role: true },
  });
  if (!member) return { authorized: false, reason: "not_member" };

  if (member.role === "owner" || member.role === "moderador") {
    return { authorized: true, reason: "role" };
  }

  // 3. Admin/member precisam de grant explícito
  const grant = await prisma.metaMcpAuthorization.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
    select: { revokedAt: true },
  });
  if (!grant) return { authorized: false, reason: "no_grant" };
  if (grant.revokedAt) return { authorized: false, reason: "revoked" };
  return { authorized: true, reason: "explicit" };
}

/**
 * Mensagem amigável pra mostrar ao user quando não autorizado.
 * O frontend usa essa mesma string no card padrão do chat.
 */
export function unauthorizedMessage(reason: AuthorizationResult["reason"]): string {
  switch (reason) {
    case "mcp_disabled":
      return "Astro Meta Ads ainda não foi habilitado nesta organização. Peça ao Master ou Moderador pra habilitar em Integrações → Meta → Astro + IA.";
    case "no_grant":
    case "revoked":
      return "Você não é autorizado a realizar essa operação. Peça ao Master ou Moderador da organização pra liberar o uso do Astro Meta Ads.";
    case "not_member":
      return "Você não tem acesso a esta organização.";
    default:
      return "Você não é autorizado a realizar essa operação.";
  }
}

/**
 * Verifica se o usuário atual pode AUTORIZAR outros (gerenciar grants).
 * Apenas owner e moderador podem.
 */
export async function canManageMcpAuthorizations(
  userId: string,
  organizationId: string,
): Promise<boolean> {
  const member = await prisma.member.findFirst({
    where: { userId, organizationId },
    select: { role: true },
  });
  return member?.role === "owner" || member?.role === "moderador";
}
