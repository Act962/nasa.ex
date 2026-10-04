"use client";

import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import type { NasaPlannerPostType } from "@/generated/prisma/enums";

/** Kanban por status e Dashboard geral do Planner (abas do topo). */

export type PlannerOriginFilter = "all" | "ai" | "human";
export const BOARD_COLUMN_KEYS = ["draft", "changes", "approval", "approved", "scheduled", "published", "failed"] as const;
export type BoardColumnKey = (typeof BOARD_COLUMN_KEYS)[number];

export function usePlannerBoard(input: { organizationIds?: string[]; types?: NasaPlannerPostType[]; origin: PlannerOriginFilter; enabled?: boolean }) {
  const { enabled = true, ...queryInput } = input;
  const { data, isLoading } = useQuery({ ...orpc.nasaPlanner.calendar.board.queryOptions({ input: queryInput }), enabled });
  return { columns: data?.columns ?? [], isLoading };
}

export function usePlannerDashboard(organizationIds?: string[]) {
  const { data, isLoading } = useQuery(orpc.nasaPlanner.dashboard.summary.queryOptions({ input: { organizationIds } }));
  return { dashboard: data ?? null, isLoading };
}
