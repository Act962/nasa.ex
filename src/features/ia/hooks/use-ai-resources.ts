import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import type { AiReportPeriod, AiUsagePeriod } from "@/features/ia/lib/ai-use-groups";

/** Recursos de IA da empresa: modelo, chave, quem paga e uso (spec 0093). Só dono e admin recebem dados. */
export function useAiResourcesOverview(options?: { enabled?: boolean; period?: AiUsagePeriod }) {
  return useQuery({
    ...orpc.ia.resourcesOverview.queryOptions({ input: { period: options?.period ?? "month" } }),
    enabled: options?.enabled ?? true,
    staleTime: 60_000,
    retry: false,
    placeholderData: keepPreviousData,
  });
}

/** Estado da IA de um recurso, para o selo dos Apps. Qualquer membro recebe o estado; o detalhe, só dono e admin. */
export function useAiResourceStatus(resourceId: string, options?: { trackingId?: string; enabled?: boolean }) {
  return useQuery({
    ...orpc.ia.resourceStatus.queryOptions({ input: { resourceId, trackingId: options?.trackingId } }),
    enabled: options?.enabled ?? true,
    staleTime: 60_000,
    retry: false,
  });
}

/** Relatório "Consumo de IA" do Insights (spec 0093). Só dono e admin recebem dados. */
export function useAiConsumptionReport(period: AiReportPeriod) {
  return useQuery({
    ...orpc.ia.consumptionReport.queryOptions({ input: { period } }),
    staleTime: 60_000,
    retry: false,
    placeholderData: keepPreviousData,
  });
}

/**
 * Tokens e custo de IA da empresa no ciclo (medidor da barra lateral e diálogo de tokens). Só dono e
 * admin recebem dados: para os demais a consulta falha uma vez e não é repetida.
 */
export function useTokenUsageOverview(options?: { enabled?: boolean; shouldRefresh?: boolean }) {
  return useQuery({
    ...orpc.ia.usage.overview.queryOptions(),
    enabled: options?.enabled ?? true,
    staleTime: 30_000,
    retry: false,
    refetchInterval: (query) => (options?.shouldRefresh && query.state.status !== "error" ? 60_000 : false),
  });
}

/** Grava as preferências de IA da empresa (etapa 2) e atualiza tudo que mostra chave, modelo e selo. */
export function useUpdateAiPreferences() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.ia.preferences.update.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: orpc.ia.resourcesOverview.key() });
        queryClient.invalidateQueries({ queryKey: orpc.ia.resourceStatus.key() });
      },
    }),
  );
}
