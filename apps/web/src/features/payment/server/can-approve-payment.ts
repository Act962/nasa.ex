/**
 * Helper server-side: pode o user X aprovar pagamentos na org Y?
 *
 * Regra (decisão fechada com produto/dev na Fase 2):
 *   1. Owner (role "owner" = Master) → SEMPRE pode.
 *   2. Admin (role "admin") → pode por default; master pode revogar setando
 *      `canApprove=false` na linha de OrgPermission do admin.
 *   3. Outras roles (member, moderador) → só com override explícito
 *      (linha em OrgPermission { appKey:"financeiro", canApprove:true }).
 *
 * Centralizar aqui evita repetir a lógica em N procedures (approve, reject,
 * list-pending, can-current-user-approve, request, etc.).
 */

import prisma from "@/lib/prisma";

const PAYMENT_APP_KEY = "financeiro";
const ROLES_WITH_DEFAULT_APPROVE = new Set(["owner", "admin"]);

export async function canUserApprovePayment(
  userId: string,
  organizationId: string,
): Promise<boolean> {
  const member = await prisma.member.findFirst({
    where: { organizationId, userId },
    select: { role: true },
  });
  if (!member) return false;

  // Owner/Admin: True por default, mas honra override explícito False.
  if (ROLES_WITH_DEFAULT_APPROVE.has(member.role)) {
    const override = await prisma.orgPermission.findUnique({
      where: {
        organizationId_role_appKey: {
          organizationId,
          role: member.role,
          appKey: PAYMENT_APP_KEY,
        },
      },
      select: { canApprove: true },
    });
    // Sem override → mantém o default (true). Com override → respeita o valor.
    return override ? override.canApprove : true;
  }

  // Outras roles: precisam de override explícito True.
  const override = await prisma.orgPermission.findUnique({
    where: {
      organizationId_role_appKey: {
        organizationId,
        role: member.role,
        appKey: PAYMENT_APP_KEY,
      },
    },
    select: { canApprove: true },
  });
  return !!override?.canApprove;
}

/**
 * Lista TODOS os user IDs da org que podem aprovar pagamentos.
 * Usado pra notificar aprovadores ao criar `PaymentApprovalRequest`.
 *
 * Não é um simples join porque a regra default difere por role: owner/admin
 * são incluídos a menos que tenham override False; outras roles só entram
 * com override True.
 */
export async function listPaymentApproverIds(
  organizationId: string,
): Promise<string[]> {
  const [members, overrides] = await Promise.all([
    prisma.member.findMany({
      where: { organizationId },
      select: { userId: true, role: true },
    }),
    prisma.orgPermission.findMany({
      where: { organizationId, appKey: PAYMENT_APP_KEY },
      select: { role: true, canApprove: true },
    }),
  ]);

  const overrideByRole = new Map(overrides.map((o) => [o.role, o.canApprove]));

  const approverIds: string[] = [];
  for (const m of members) {
    const override = overrideByRole.get(m.role);
    if (ROLES_WITH_DEFAULT_APPROVE.has(m.role)) {
      // Owner/Admin: incluído a menos que override seja explicitamente false.
      if (override === undefined || override === true) approverIds.push(m.userId);
    } else {
      // Outras roles: só com override true.
      if (override === true) approverIds.push(m.userId);
    }
  }
  return approverIds;
}
