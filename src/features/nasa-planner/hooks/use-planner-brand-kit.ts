"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

/** Kits da Marca do cliente e "Gerar com o Astro" (specs 0063 e 0070). */

function useInvalidateBrandKit() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: orpc.nasaPlanner.brandKit.key() });
}

/**
 * Sem opções, o kit padrão da empresa. `brandKitId` abre um kit adicional; `instagramAccountId`
 * abre o kit que aquela conta usa (é o caso do criador de conteúdo).
 */
export function usePlannerBrandKit(
  organizationId: string | null,
  { brandKitId = null, instagramAccountId = null }: { brandKitId?: string | null; instagramAccountId?: string | null } = {},
) {
  const { data, isLoading, error } = useQuery({
    ...orpc.nasaPlanner.brandKit.get.queryOptions({ input: { organizationId: organizationId ?? "", brandKitId, instagramAccountId } }),
    enabled: Boolean(organizationId),
    retry: false,
  });
  return { brandKit: data ?? null, isLoading, error };
}

/** Kits da empresa com o medidor de cada um e as contas do Instagram com o kit que usam. */
export function usePlannerBrandKits(organizationId: string | null) {
  const { data, isLoading } = useQuery({
    ...orpc.nasaPlanner.brandKit.list.queryOptions({ input: { organizationId: organizationId ?? "" } }),
    enabled: Boolean(organizationId),
  });
  return {
    kits: data?.kits ?? [],
    accounts: data?.accounts ?? [],
    limit: data?.limit ?? 0,
    canLinkAccounts: data?.canLinkAccounts ?? false,
    isLoading,
  };
}

export function useCreatePlannerBrandKit() {
  const invalidate = useInvalidateBrandKit();
  return useMutation(orpc.nasaPlanner.brandKit.create.mutationOptions({ onSuccess: invalidate }));
}

export function useRenamePlannerBrandKit() {
  const invalidate = useInvalidateBrandKit();
  return useMutation(orpc.nasaPlanner.brandKit.rename.mutationOptions({ onSuccess: invalidate }));
}

export function useDeletePlannerBrandKit() {
  const invalidate = useInvalidateBrandKit();
  return useMutation(orpc.nasaPlanner.brandKit.delete.mutationOptions({ onSuccess: invalidate }));
}

/** Escolhe o kit de uma conta do Instagram (owner e admin). */
export function useSetPlannerAccountBrandKit() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.nasaPlanner.brandKit.setAccountKit.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: orpc.nasaPlanner.brandKit.key() });
        void queryClient.invalidateQueries({ queryKey: orpc.socialAccounts.key() });
      },
    }),
  );
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
