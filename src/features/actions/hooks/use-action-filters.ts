import {
  parseAsArrayOf,
  parseAsBoolean,
  parseAsIsoDateTime,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from "nuqs";

export const SORT_BY_OPTIONS = [
  "order",
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
  projectIds: string[];
  dueDateFrom: Date | null;
  dueDateTo: Date | null;
  sortBy: SortBy;
  sortOrder: SortOrder;
  showArchived: boolean;
}

export const DEFAULT_FILTERS: FiltersState = {
  participantIds: [],
  tagIds: [],
  projectIds: [],
  dueDateFrom: null,
  dueDateTo: null,
  sortBy: "order",
  sortOrder: "asc",
  showArchived: false,
};

const actionFiltersParsers = {
  af_participants: parseAsArrayOf(parseAsString).withDefault([]),
  af_tags: parseAsArrayOf(parseAsString).withDefault([]),
  af_projects: parseAsArrayOf(parseAsString).withDefault([]),
  af_from: parseAsIsoDateTime,
  af_to: parseAsIsoDateTime,
  af_sort: parseAsStringLiteral(SORT_BY_OPTIONS).withDefault("order"),
  af_order: parseAsStringLiteral(SORT_ORDER_OPTIONS).withDefault("asc"),
  af_archived: parseAsBoolean.withDefault(false),
};

export function useActionFilters() {
  const [params, setParams] = useQueryStates(actionFiltersParsers, {
    history: "replace",
  });

  const filters: FiltersState = {
    participantIds: params.af_participants,
    tagIds: params.af_tags,
    projectIds: params.af_projects,
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
      af_projects: next.projectIds,
      af_from: next.dueDateFrom,
      af_to: next.dueDateTo,
      af_sort: next.sortBy,
      af_order: next.sortOrder,
      af_archived: next.showArchived,
    });

  const activeCount = [
    filters.participantIds.length > 0,
    filters.tagIds.length > 0,
    filters.projectIds.length > 0,
    filters.dueDateFrom || filters.dueDateTo,
    filters.sortBy !== "order" || filters.sortOrder !== "asc",
    filters.showArchived,
  ].filter(Boolean).length;

  const clearFilters = () => setFilters(DEFAULT_FILTERS);

  return { filters, setFilters, activeCount, clearFilters };
}
