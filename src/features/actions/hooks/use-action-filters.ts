import {
  parseAsArrayOf,
  parseAsBoolean,
  parseAsIsoDateTime,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from "nuqs";

export const SORT_BY_OPTIONS = [
  "createdAt",
  "dueDate",
  "priority",
  "title",
] as const;

export const SORT_ORDER_OPTIONS = ["asc", "desc"] as const;

export type SortBy = (typeof SORT_BY_OPTIONS)[number];
export type SortOrder = (typeof SORT_ORDER_OPTIONS)[number];

export interface FiltersState {
  participantIds: string[];
  tagIds: string[];
  dueDateFrom: Date | null;
  dueDateTo: Date | null;
  sortBy: SortBy;
  sortOrder: SortOrder;
  showArchived: boolean;
}

export const DEFAULT_FILTERS: FiltersState = {
  participantIds: [],
  tagIds: [],
  dueDateFrom: null,
  dueDateTo: null,
  sortBy: "createdAt",
  sortOrder: "desc",
  showArchived: false,
};

const actionFiltersParsers = {
  af_participants: parseAsArrayOf(parseAsString).withDefault([]),
  af_tags: parseAsArrayOf(parseAsString).withDefault([]),
  af_from: parseAsIsoDateTime,
  af_to: parseAsIsoDateTime,
  af_sort: parseAsStringLiteral(SORT_BY_OPTIONS).withDefault("createdAt"),
  af_order: parseAsStringLiteral(SORT_ORDER_OPTIONS).withDefault("desc"),
  af_archived: parseAsBoolean.withDefault(false),
};

export function useActionFilters() {
  const [params, setParams] = useQueryStates(actionFiltersParsers, {
    history: "replace",
  });

  const filters: FiltersState = {
    participantIds: params.af_participants,
    tagIds: params.af_tags,
    dueDateFrom: params.af_from,
    dueDateTo: params.af_to,
    sortBy: params.af_sort,
    sortOrder: params.af_order,
    showArchived: params.af_archived,
  };

  const setFilters = (next: FiltersState) =>
    setParams({
      af_participants: next.participantIds,
      af_tags: next.tagIds,
      af_from: next.dueDateFrom,
      af_to: next.dueDateTo,
      af_sort: next.sortBy,
      af_order: next.sortOrder,
      af_archived: next.showArchived,
    });

  const activeCount = [
    filters.participantIds.length > 0,
    filters.tagIds.length > 0,
    filters.dueDateFrom || filters.dueDateTo,
    filters.sortBy !== "createdAt" || filters.sortOrder !== "desc",
    filters.showArchived,
  ].filter(Boolean).length;

  const clearFilters = () => setFilters(DEFAULT_FILTERS);

  return { filters, setFilters, activeCount, clearFilters };
}
