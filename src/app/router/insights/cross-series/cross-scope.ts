import type { CrossDatasetDef, CrossSeriesFilters } from "@/features/insights/lib/cross-chart-catalog";
import { DEFAULT_SERIES_RANGE_DAYS } from "@/features/insights/lib/cross-chart-catalog";

/** Filtros de uma série já resolvidos: empresas permitidas, intervalo de datas e só os filtros que a série aceita. */
export interface CrossScope {
  organizationIds: string[];
  range: { gte: Date; lte: Date };
  trackingIds?: string[];
  tagIds?: string[];
  statusIds?: string[];
  memberIds?: string[];
  workspaceIds?: string[];
  paymentAccountIds?: string[];
  paymentCategoryIds?: string[];
}

const DAY_MS = 1000 * 60 * 60 * 24;

function nonEmpty(values?: string[]): string[] | undefined {
  return values && values.length > 0 ? values : undefined;
}

export function resolveSeriesRange(filters: CrossSeriesFilters): { gte: Date; lte: Date } {
  const rangeEnd = filters.endDate ? new Date(filters.endDate) : new Date();
  const rangeStart = filters.startDate
    ? new Date(filters.startDate)
    : new Date(rangeEnd.getTime() - DEFAULT_SERIES_RANGE_DAYS * DAY_MS);
  return { gte: rangeStart, lte: rangeEnd };
}

export function buildCrossScope(
  dataset: CrossDatasetDef,
  filters: CrossSeriesFilters,
  organizationIds: string[],
): CrossScope {
  const accepts = (filterKey: CrossDatasetDef["filters"][number]) => dataset.filters.includes(filterKey);
  return {
    organizationIds,
    range: resolveSeriesRange(filters),
    trackingIds: accepts("tracking") ? nonEmpty(filters.trackingIds) : undefined,
    tagIds: accepts("tag") ? nonEmpty(filters.tagIds) : undefined,
    statusIds: accepts("status") ? nonEmpty(filters.statusIds) : undefined,
    memberIds: accepts("attendant") ? nonEmpty(filters.memberIds) : undefined,
    workspaceIds: accepts("workspace") ? nonEmpty(filters.workspaceIds) : undefined,
    paymentAccountIds: accepts("paymentAccount") ? nonEmpty(filters.paymentAccountIds) : undefined,
    paymentCategoryIds: accepts("paymentCategory") ? nonEmpty(filters.paymentCategoryIds) : undefined,
  };
}

/** `where` de Lead com os filtros de lead da série (tracking, tag, status, atendente), sem data. */
export function leadWhereOf(scope: CrossScope) {
  return {
    tracking: { organizationId: { in: scope.organizationIds } },
    currentAction: { not: "DELETED" as const },
    ...(scope.trackingIds ? { trackingId: { in: scope.trackingIds } } : {}),
    ...(scope.tagIds ? { leadTags: { some: { tagId: { in: scope.tagIds } } } } : {}),
    ...(scope.statusIds ? { statusId: { in: scope.statusIds } } : {}),
    ...(scope.memberIds ? { responsibleId: { in: scope.memberIds } } : {}),
  };
}

export function trackingWhereOf(scope: CrossScope) {
  return scope.trackingIds ? { trackingId: { in: scope.trackingIds } } : {};
}
