"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import type { SalesGoalPeriodType } from "../lib/sales-goal-xlsx-parser";

export function useSalesGoalRanking(
  periodType: SalesGoalPeriodType,
  periodStart?: string,
  includeInactiveBranches?: boolean,
) {
  return useQuery(
    orpc.nerp.ranking.list.queryOptions({
      input: { periodType, periodStart, includeInactiveBranches },
    }),
  );
}

export function useSalesGoalPeriods(periodType?: SalesGoalPeriodType) {
  return useQuery(orpc.nerp.ranking.listPeriods.queryOptions({ input: { periodType } }));
}

export function useImportSalesGoalRanking() {
  const qc = useQueryClient();
  return useMutation(
    orpc.nerp.ranking.import.mutationOptions({
      onSuccess: () => qc.invalidateQueries({ queryKey: ["nerp"] }),
    }),
  );
}

export function useUpsertSalesGoalEntry() {
  const qc = useQueryClient();
  return useMutation(
    orpc.nerp.ranking.upsertEntry.mutationOptions({
      onSuccess: () => qc.invalidateQueries({ queryKey: ["nerp"] }),
    }),
  );
}

export function useDeleteSalesGoalEntry() {
  const qc = useQueryClient();
  return useMutation(
    orpc.nerp.ranking.deleteEntry.mutationOptions({
      onSuccess: () => qc.invalidateQueries({ queryKey: ["nerp"] }),
    }),
  );
}

export function useUpdateSalesGoalBranch() {
  const qc = useQueryClient();
  return useMutation(
    orpc.nerp.ranking.updateBranch.mutationOptions({
      onSuccess: () => qc.invalidateQueries({ queryKey: ["nerp"] }),
    }),
  );
}

export function useSalesGoalEvolution(periodType?: SalesGoalPeriodType) {
  return useQuery(orpc.nerp.ranking.evolution.queryOptions({ input: { periodType } }));
}

export function useSalesGoalRankingSettings() {
  return useQuery(orpc.nerp.ranking.settings.get.queryOptions({ input: {} }));
}

export function useUpdateSalesGoalRankingSettings() {
  const qc = useQueryClient();
  return useMutation(
    orpc.nerp.ranking.settings.update.mutationOptions({
      onSuccess: () => qc.invalidateQueries({ queryKey: ["nerp"] }),
    }),
  );
}
