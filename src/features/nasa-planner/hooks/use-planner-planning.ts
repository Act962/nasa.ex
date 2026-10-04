"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

/** Criar conteúdo para qualquer cliente, metas de cadência, horários e pilares (spec 0058). */

function useInvalidatePlanner() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: orpc.nasaPlanner.key() });
}

export function useCreatePlannerClientPost() {
  const invalidatePlanner = useInvalidatePlanner();
  return useMutation(orpc.nasaPlanner.posts.createForClient.mutationOptions({ onSuccess: invalidatePlanner }));
}

export function useUpdatePlannerPostV2() {
  const invalidatePlanner = useInvalidatePlanner();
  return useMutation(orpc.nasaPlanner.posts.update.mutationOptions({ onSuccess: invalidatePlanner }));
}

export function useDeletePlannerPostV2() {
  const invalidatePlanner = useInvalidatePlanner();
  return useMutation(orpc.nasaPlanner.posts.delete.mutationOptions({ onSuccess: invalidatePlanner }));
}

export function usePlannerGoals(organizationIds?: string[]) {
  const { data } = useQuery(orpc.nasaPlanner.planning.getGoals.queryOptions({ input: { organizationIds } }));
  return { goals: data?.goals ?? [] };
}

export function useSetPlannerGoal() {
  const invalidatePlanner = useInvalidatePlanner();
  return useMutation(orpc.nasaPlanner.planning.setGoal.mutationOptions({ onSuccess: invalidatePlanner }));
}

export function usePlannerPillars(organizationIds?: string[]) {
  const { data } = useQuery(orpc.nasaPlanner.planning.listPillars.queryOptions({ input: { organizationIds } }));
  return { pillars: data?.pillars ?? [] };
}

export function useUpsertPlannerPillar() {
  const invalidatePlanner = useInvalidatePlanner();
  return useMutation(orpc.nasaPlanner.planning.upsertPillar.mutationOptions({ onSuccess: invalidatePlanner }));
}
