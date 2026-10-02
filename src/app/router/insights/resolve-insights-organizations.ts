import prisma from "@/lib/prisma";

/**
 * Empresas que uma consulta do Insights pode ler. Só entram empresas de que o usuário é membro —
 * um ID de outra empresa vindo do navegador é descartado. Sem seleção ("Todas as Empresas"),
 * valem todas as empresas do usuário, o mesmo critério do relatório do Tracking.
 */
export async function resolveInsightsOrganizationIds({
  userId,
  activeOrganizationId,
  requestedOrganizationIds,
}: {
  userId: string;
  activeOrganizationId: string;
  requestedOrganizationIds?: string[];
}): Promise<string[]> {
  const memberships = await prisma.member.findMany({
    where: { userId },
    select: { organizationId: true },
  });
  const memberOrganizationIds = memberships.map((membership) => membership.organizationId);
  if (memberOrganizationIds.length === 0) return [activeOrganizationId];

  if (requestedOrganizationIds && requestedOrganizationIds.length > 0) {
    const allowedOrganizationIds = requestedOrganizationIds.filter((organizationId) =>
      memberOrganizationIds.includes(organizationId),
    );
    return allowedOrganizationIds.length > 0 ? allowedOrganizationIds : [activeOrganizationId];
  }
  return memberOrganizationIds;
}
