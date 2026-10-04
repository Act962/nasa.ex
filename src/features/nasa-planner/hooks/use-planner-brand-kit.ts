"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

/** Kit da Marca do cliente e "Gerar com o Astro" (spec 0063). */

function useInvalidateBrandKit() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: orpc.nasaPlanner.brandKit.get.key() });
}

export function usePlannerBrandKit(organizationId: string | null) {
  const { data, isLoading, error } = useQuery({
    ...orpc.nasaPlanner.brandKit.get.queryOptions({ input: { organizationId: organizationId ?? "" } }),
    enabled: Boolean(organizationId),
  });
  return { brandKit: data ?? null, isLoading, error };
}

export function useSavePlannerBrandKit() {
  const invalidate = useInvalidateBrandKit();
  return useMutation(orpc.nasaPlanner.brandKit.save.mutationOptions({ onSuccess: invalidate }));
}

export function useAddPlannerBrandKitAsset() {
  const invalidate = useInvalidateBrandKit();
  return useMutation(orpc.nasaPlanner.brandKit.addAsset.mutationOptions({ onSuccess: invalidate }));
}

export function useRemovePlannerBrandKitAsset() {
  const invalidate = useInvalidateBrandKit();
  return useMutation(orpc.nasaPlanner.brandKit.removeAsset.mutationOptions({ onSuccess: invalidate }));
}

export function useGeneratePlannerScripts() {
  return useMutation(orpc.nasaPlanner.brandKit.generateScripts.mutationOptions());
}
