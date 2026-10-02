import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

const USAGE_SUMMARY_STALE_MS = 60_000;

/** IA em uso, modelos, preços e saldos para o ícone de uso abaixo da caixa da Início (spec 0055). */
export function useAstroUsageSummary(
  options: { refetchIntervalMs?: number; providerOrder?: Array<"openai" | "google" | "anthropic">; disabledModelIds?: string[] } = {},
) {
  return useQuery({
    ...orpc.astro.usageSummary.queryOptions({
      input: { providerOrder: options.providerOrder, disabledModelIds: options.disabledModelIds },
    }),
    staleTime: options.refetchIntervalMs ? 0 : USAGE_SUMMARY_STALE_MS,
    refetchInterval: options.refetchIntervalMs ?? false,
    // Mudar a ordem das IAs troca a chave: mantém o painel aberto com os dados anteriores até chegar o novo.
    placeholderData: keepPreviousData,
  });
}

export function useAstroModelPricing(options: { enabled?: boolean } = {}) {
  return useQuery({ ...orpc.astro.modelPricing.get.queryOptions(), enabled: options.enabled ?? true });
}

export function useSetAstroModelPricing() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.astro.modelPricing.set.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: orpc.astro.modelPricing.key() });
        void queryClient.invalidateQueries({ queryKey: orpc.astro.usageSummary.key() });
      },
    }),
  );
}
