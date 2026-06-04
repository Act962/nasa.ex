import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

/**
 * Hooks oRPC do Astro Bot via WhatsApp. Mutations invalidam o cache
 * relevante automaticamente; toasts/redirects ficam no componente.
 */

export function useBotConfig() {
  const query = useQuery(orpc.astroBot.config.get.queryOptions({ input: {} }));
  return {
    config: query.data?.config ?? null,
    availableInstances: query.data?.availableInstances ?? [],
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

export function useStartBindingOtp() {
  return useMutation(orpc.astroBot.binding.startOtp.mutationOptions());
}

export function useVerifyBindingOtp() {
  const qc = useQueryClient();
  return useMutation(
    orpc.astroBot.binding.verifyOtp.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries({
          queryKey: orpc.astroBot.binding.list.queryKey(),
        });
      },
    }),
  );
}

export function useRevokeBinding() {
  const qc = useQueryClient();
  return useMutation(
    orpc.astroBot.binding.revoke.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries({
          queryKey: orpc.astroBot.binding.list.queryKey(),
        });
      },
    }),
  );
}

export function useResetBindingPin() {
  return useMutation(orpc.astroBot.binding.resetPin.mutationOptions());
}
