"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

export const SP_KEY = ["spacePoint", "me"] as const;

export function useSpacePoint() {
  return useQuery({
    ...orpc.spacePoint.me.queryOptions(),
    queryKey: SP_KEY,
    staleTime: 30_000,
  });
}

export type RankingPeriod =
  | "weekly"
  | "biweekly"
  | "monthly"
  | "annual"
  | "alltime"
  | "custom";

export function useSpacePointRanking(
  period: RankingPeriod = "weekly",
  startDate?: string,
  endDate?: string,
) {
  return useQuery({
    ...orpc.spacePoint.ranking.queryOptions({
      input: { period, startDate, endDate },
    }),
    queryKey: ["spacePoint", "ranking", period, startDate, endDate],
    staleTime: 60_000,
  });
}

export function useUserStats(
  targetUserId: string | null,
  period: RankingPeriod = "alltime",
  startDate?: string,
  endDate?: string,
) {
  return useQuery({
    ...orpc.spacePoint.userStats.queryOptions({
      input: { targetUserId: targetUserId ?? "", period, startDate, endDate },
    }),
    queryKey: [
      "spacePoint",
      "userStats",
      targetUserId,
      period,
      startDate,
      endDate,
    ],
    enabled: !!targetUserId,
    staleTime: 30_000,
  });
}

export function useSpacePointRules() {
  return useQuery({
    ...orpc.spacePoint.rules.queryOptions(),
    queryKey: ["spacePoint", "rules"],
    staleTime: 60_000,
  });
}

export function useSpacePointPrizes(period: string) {
  return useQuery({
    ...orpc.spacePoint.prizes.queryOptions({ input: { period } }),
    queryKey: ["spacePoint", "prizes", period],
    staleTime: 60_000,
  });
}

export function useEarnSpacePoints() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      action: string;
      description?: string;
      metadata?: Record<string, unknown>;
    }) => orpc.spacePoint.earn.call(vars),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SP_KEY });
    },
  });
}

export function useUpdateSpacePointRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      id: string;
      points?: number;
      cooldownHours?: number | null;
      isActive?: boolean;
      label?: string;
    }) => orpc.spacePoint.updateRule.call(vars),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["spacePoint", "rules"] });
    },
  });
}

export function useCreateSpacePointRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      action: string;
      label: string;
      points: number;
      cooldownHours?: number | null;
    }) => orpc.spacePoint.createRule.call(vars),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["spacePoint", "rules"] });
    },
  });
}

export function useDeleteSpacePointRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string }) => orpc.spacePoint.deleteRule.call(vars),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["spacePoint", "rules"] });
    },
  });
}

export function useUpsertSpacePointPrize() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      rank: number;
      period: string;
      title: string;
      description?: string;
      isActive?: boolean;
    }) => orpc.spacePoint.upsertPrize.call(vars),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["spacePoint", "prizes", vars.period] });
    },
  });
}

export function useDeleteSpacePointPrize() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; period: string }) =>
      orpc.spacePoint.deletePrize.call({ id: vars.id }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["spacePoint", "prizes", vars.period] });
    },
  });
}
