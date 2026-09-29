import type { Prisma } from "@/generated/prisma/client";
import type { LeadMetricsFilter } from "../schema/broadcast-schemas";

// Filtro de comportamento do lead nas audiências (spec 0035). Sem nenhum campo
// preenchido, não filtra — e lead sem métricas não é excluído à toa.

export function buildLeadMetricsWhere(filter: LeadMetricsFilter | undefined): Prisma.LeadWhereInput | null {
  if (!filter) return null;
  const metrics: Prisma.LeadMetricsWhereInput = {};
  if (filter.interestLevels?.length) metrics.interestLevel = { in: filter.interestLevels };
  if (filter.minPurchasePotential !== undefined) metrics.purchasePotential = { gte: filter.minPurchasePotential };
  if (filter.minPurchases !== undefined) metrics.purchasesCount = { gte: filter.minPurchases };
  if (filter.maxInteractionLossRate !== undefined) metrics.interactionLossRate = { lte: filter.maxInteractionLossRate };
  return Object.keys(metrics).length > 0 ? { metrics: { is: metrics } } : null;
}
