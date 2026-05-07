import "server-only";
import prisma from "@/lib/prisma";

/**
 * Validações de acesso reaproveitáveis pelas tools dos sub-agentes.
 *
 * Convenção: cada helper recebe `userId` + `organizationId` da AgentContext e
 * o ID do recurso. Retorna `true`/`false` (não throw) — quem chama decide se
 * vira erro de tool ou mensagem amigável.
 */

export async function userBelongsToOrg(userId: string, organizationId: string) {
  const member = await prisma.member.findFirst({
    where: { userId, organizationId },
    select: { id: true },
  });
  return Boolean(member);
}

export async function userIsOrgAdmin(userId: string, organizationId: string) {
  const member = await prisma.member.findFirst({
    where: { userId, organizationId },
    select: { role: true },
  });
  return member?.role === "owner" || member?.role === "admin";
}

export async function userCanAccessTracking(
  userId: string,
  trackingId: string,
) {
  const tracking = await prisma.tracking.findUnique({
    where: { id: trackingId },
    select: { organizationId: true },
  });
  if (!tracking) return false;
  return userBelongsToOrg(userId, tracking.organizationId);
}

export async function userCanAccessLead(userId: string, leadId: string) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { tracking: { select: { organizationId: true } } },
  });
  if (!lead?.tracking) return false;
  return userBelongsToOrg(userId, lead.tracking.organizationId);
}

export async function userCanAccessWorkspace(
  userId: string,
  workspaceId: string,
) {
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      organizationId: true,
      members: { where: { userId }, select: { id: true } },
    },
  });
  if (!ws) return false;
  // Membro direto do workspace OU membro da org dona
  if (ws.members.length > 0) return true;
  return userBelongsToOrg(userId, ws.organizationId);
}
