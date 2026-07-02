import "server-only";
import prisma from "@/lib/prisma";
import type { AgentContext } from "@/features/astro/server/agents/types";

/**
 * Resolve as organizações-alvo de uma tool de leitura do Astro.
 *
 * Default (Cmd+K in-app): todas as orgs em que o usuário é membro — dashboards
 * multi-org continuam agregando como antes. Quando `ctx.restrictToOrgId` está
 * setado (Astro pelo WhatsApp, que responde pelo número de UMA tracking), a
 * resposta é travada nessa org e nenhuma outra — mesmo que o usuário participe
 * de várias. Sem isso, um número allow-listado consultaria dados de qualquer
 * org do membro.
 *
 * `requestedOrgIds` (vindo do LLM) é sempre interseccionado com o permitido —
 * nunca expande além das memberships nem do restrict.
 */
export async function resolveTargetOrgs(
  ctx: AgentContext,
  requestedOrgIds?: string[],
): Promise<string[]> {
  const memberships = await prisma.member.findMany({
    where: { userId: ctx.userId },
    select: { organizationId: true },
  });
  const myOrgIds = memberships.map((member) => member.organizationId);

  // Quando há restrição explícita, trava NELA (interseccionada com as
  // memberships). Membro de fora → sem acesso (lista vazia), nunca fallback
  // pro conjunto inteiro.
  const allowedOrgIds = ctx.restrictToOrgId
    ? myOrgIds.filter((orgId) => orgId === ctx.restrictToOrgId)
    : myOrgIds;

  if (requestedOrgIds && requestedOrgIds.length > 0) {
    return requestedOrgIds.filter((orgId) => allowedOrgIds.includes(orgId));
  }
  return allowedOrgIds;
}
