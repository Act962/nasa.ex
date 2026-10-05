"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

/** Caixa de criações: rascunhos vindos de IA (spec 0065). */

export function usePlannerCreations(organizationIds?: string[]) {
  const { data, isLoading } = useQuery(orpc.nasaPlanner.creations.list.queryOptions({ input: { organizationIds } }));
  return { creations: data?.creations ?? [], isLoading };
}

function useInvalidatePlanner() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: orpc.nasaPlanner.key() });
}

export function useDiscardPlannerCreation() {
  const invalidate = useInvalidatePlanner();
  return useMutation(orpc.nasaPlanner.creations.discard.mutationOptions({ onSuccess: invalidate }));
}

export function useImportPlannerCreation() {
  const invalidate = useInvalidatePlanner();
  return useMutation(orpc.nasaPlanner.creations.import.mutationOptions({ onSuccess: invalidate }));
}
