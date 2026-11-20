"use client";

import { useMemo, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import type { NasaPlannerPostType } from "@/generated/prisma/enums";

/** Kanban por status e Dashboard geral do Planner (abas do topo). */

export type PlannerOriginFilter = "all" | "ai" | "human";
export const BOARD_COLUMN_KEYS = ["draft", "changes", "approval", "approved", "scheduled", "published", "failed"] as const;
export type BoardColumnKey = (typeof BOARD_COLUMN_KEYS)[number];

export interface PlannerBoardFilters {
  organizationIds?: string[];
  types?: NasaPlannerPostType[];
  origin: PlannerOriginFilter;
}

export function usePlannerBoard(input: PlannerBoardFilters & { enabled?: boolean }) {
  const { enabled = true, ...queryInput } = input;
  const { data, isLoading } = useQuery({ ...orpc.nasaPlanner.calendar.board.queryOptions({ input: queryInput }), enabled });
  return { columns: data?.columns ?? [], isLoading };
}

/**
 * Páginas seguintes de uma coluna do Kanban; a primeira já vem em `usePlannerBoard`.
 * Fica parada até a coluna ser rolada até o fim; depois segue ativa para a invalidação do Planner recarregar as páginas.
 */
export function usePlannerBoardColumnMore(input: { filters: PlannerBoardFilters; columnKey: BoardColumnKey; firstCursor: string | null }) {
  const { filters, columnKey, firstCursor } = input;
  const [wasRequested, setWasRequested] = useState(false);
  const isEnabled = wasRequested && Boolean(firstCursor);
  const { data, fetchNextPage, hasNextPage, isFetching, isFetchingNextPage } = useInfiniteQuery(
    orpc.nasaPlanner.calendar.boardColumn.infiniteOptions({
      input: (cursor: string) => ({ ...filters, columnKey, cursor }),
      initialPageParam: firstCursor ?? "",
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
      enabled: isEnabled,
    }),
  );
  const morePosts = useMemo(() => data?.pages.flatMap((page) => page.posts) ?? [], [data]);
  const canLoadMore = Boolean(firstCursor) && (!data || hasNextPage);
  const loadMore = () => {
    if (!canLoadMore || isFetching) return;
    if (!wasRequested) setWasRequested(true);
    else void fetchNextPage();
  };
  return { morePosts, canLoadMore, isLoadingMore: isFetchingNextPage || (isEnabled && !data), loadMore };
}

export function usePlannerDashboard(organizationIds?: string[]) {
  const { data, isLoading } = useQuery(orpc.nasaPlanner.dashboard.summary.queryOptions({ input: { organizationIds } }));
  return { dashboard: data ?? null, isLoading };
}
