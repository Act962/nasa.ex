import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";

/**
 * Lista todas as empresas que têm pelo menos um evento público publicado
 * no Calendário Público — pra alimentar o filtro "Empresa".
 */
export const listOrganizations = base.handler(async () => {
  const rows = await prisma.action.findMany({
    where: {
      isPublic: true,
      isArchived: false,
      isGuestDraft: false,
      publishedAt: { not: null },
      organizationId: { not: null },
    },
    select: {
      organizationId: true,
      organization: { select: { id: true, name: true, logo: true } },
    },
    distinct: ["organizationId"],
  });

  // Conta eventos por org pra ordenar (mais ativas primeiro).
  const counts = await prisma.action.groupBy({
    by: ["organizationId"],
    where: {
      isPublic: true,
      isArchived: false,
      isGuestDraft: false,
      publishedAt: { not: null },
      organizationId: { not: null },
    },
    _count: { _all: true },
  });
  const countByOrg = new Map(
    counts.map((c) => [c.organizationId, c._count._all]),
  );

  return {
    organizations: rows
      .filter((r) => r.organization)
      .map((r) => ({
        id: r.organization!.id,
        name: r.organization!.name,
        logo: r.organization!.logo ?? null,
        count: countByOrg.get(r.organizationId!) ?? 0,
      }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
  };
});
