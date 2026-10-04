"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

/** Roteiro da semana (spec 0067): tema fixo por dia da semana e separação do roteiro colado. */

export function usePlannerWeekdayThemes(organizationIds?: string[]) {
  const { data } = useQuery(orpc.nasaPlanner.planning.listWeekdayThemes.queryOptions({ input: { organizationIds } }));
  return { themes: data?.themes ?? [] };
}

export function useSetPlannerWeekdayTheme() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.nasaPlanner.planning.setWeekdayTheme.mutationOptions({ onSuccess: () => queryClient.invalidateQueries({ queryKey: orpc.nasaPlanner.key() }) }),
  );
}

export function useParsePlannerWeeklyScript() {
  return useMutation(orpc.nasaPlanner.planning.parseWeeklyScript.mutationOptions());
}
