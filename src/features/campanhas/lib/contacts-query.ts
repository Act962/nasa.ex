import type { Prisma } from "@/generated/prisma/client";
import type { ContactFiltersInput } from "../schema/broadcast-schemas";

/**
 * Constrói o `where` do Prisma da base unificada de contatos a partir da org +
 * filtros. Query builder puro (sem I/O) — compartilhado por `listContacts`
 * (listagem) e `addRecipientsFromContacts` (seleção "todos que casam").
 */
export function buildContactsWhere(
  organizationId: string,
  filters: ContactFiltersInput,
): Prisma.LeadWhereInput {
  const where: Prisma.LeadWhereInput = {
    tracking: { organizationId },
    phone: { not: null },
    currentAction: filters.actionFilter ?? "ACTIVE",
  };

  if (filters.trackingId) where.trackingId = filters.trackingId;
  if (filters.statusIds?.length) where.statusId = { in: filters.statusIds };
  if (filters.temperatureFilter?.length) {
    where.temperature = { in: filters.temperatureFilter };
  }
  if (filters.tagsFilter?.length) {
    where.leadTags = { some: { tag: { slug: { in: filters.tagsFilter } } } };
  }
  if (filters.participantFilter) {
    where.responsible = { email: filters.participantFilter };
  }
  if (filters.dateInit && filters.dateEnd) {
    where.createdAt = {
      gte: new Date(filters.dateInit),
      lte: new Date(filters.dateEnd),
    };
  }
  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: "insensitive" } },
      { phone: { contains: filters.search } },
    ];
  }

  return where;
}
