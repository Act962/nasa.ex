import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

export function useAstroAiMode() {
  return useQuery(orpc.astro.aiMode.get.queryOptions());
}

export function useSetAstroAiMode() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.astro.aiMode.set.mutationOptions({
      onSuccess: () => queryClient.invalidateQueries({ queryKey: orpc.astro.aiMode.key() }),
    }),
  );
}
