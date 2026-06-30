import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

/**
 * Hooks oRPC do Astro pelo WhatsApp (Insights). Mutations invalidam o cache
 * relevante automaticamente; toasts/redirects ficam no componente.
 */

export function useBotConfig() {
  const query = useQuery(orpc.astroBot.config.get.queryOptions({ input: {} }));
  return {
    config: query.data?.config ?? null,
    availableTrackings: query.data?.availableTrackings ?? [],
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}

export function useUpsertBotConfig() {
  const qc = useQueryClient();
  return useMutation(
    orpc.astroBot.config.upsert.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: orpc.astroBot.config.get.queryKey() });
      },
    }),
  );
}

export function useBindings(scope: "mine" | "org" = "mine") {
  const query = useQuery(
    orpc.astroBot.binding.list.queryOptions({ input: { scope } }),
  );
  return {
    bindings: query.data?.bindings ?? [],
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}

export function useCreateBinding() {
  const qc = useQueryClient();
  return useMutation(
    orpc.astroBot.binding.create.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: orpc.astroBot.binding.list.key() });
      },
    }),
  );
}

export function useRevokeBinding() {
  const qc = useQueryClient();
  return useMutation(
    orpc.astroBot.binding.revoke.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: orpc.astroBot.binding.list.key() });
      },
    }),
  );
}

/** Membros da org pra mapear um número a um usuário (reusa permissions). */
export function useOrgMembers() {
  const query = useQuery(orpc.permissions.getPermissions.queryOptions());
  return {
    members: query.data?.members ?? [],
    isLoading: query.isLoading,
  };
}
