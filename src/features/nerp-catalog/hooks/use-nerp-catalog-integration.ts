import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useNerpCatalogIntegration() {
  return useQuery(orpc.nerp.catalogIntegration.get.queryOptions());
}

export function useUpsertNerpCatalogIntegration() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.nerp.catalogIntegration.upsert.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.nerp.catalogIntegration.get.queryKey(),
        });
      },
    }),
  );
}
