import type { Prisma } from "@/generated/prisma/client";
import type { AudienceFilter } from "../schema/broadcast-schemas";

/**
 * Constrói o `where` do Prisma pra resolver a audiência de leads de uma
 * campanha a partir do tracking de origem + filtros opcionais.
 *
 * Query builder puro (sem I/O) — testável isoladamente. Espelha o vocabulário
 * de `leads.listLeadsByStatus`. Sem `actionFilter`, considera só leads
 * `ACTIVE` (não trazer perdidos/deletados por default num disparo).
 */
export function buildLeadAudienceWhere(
  trackingId: string,
  filters: AudienceFilter,
): Prisma.LeadWhereInput {
  const where: Prisma.LeadWhereInput = {
    trackingId,
    currentAction: filters.actionFilter ?? "ACTIVE",
    // Só leads com telefone rendem destinatário — filtra cedo pra evitar
    // linhas sem phone virarem no-op no dedupe.
    phone: { not: null },
  };

  if (filters.statusIds && filters.statusIds.length > 0) {
    where.statusId = { in: filters.statusIds };
  }

  if (filters.tagsFilter && filters.tagsFilter.length > 0) {
    where.leadTags = {
      some: { tag: { slug: { in: filters.tagsFilter } } },
    };
  }

  if (filters.temperatureFilter && filters.temperatureFilter.length > 0) {
    where.temperature = { in: filters.temperatureFilter };
  }

  if (filters.projectsFilter && filters.projectsFilter.length > 0) {
    where.orgProjectId = { in: filters.projectsFilter };
  }

  if (filters.participantFilter) {
    where.responsible = { email: filters.participantFilter };
  }

  return where;
}
