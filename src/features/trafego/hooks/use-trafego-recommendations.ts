import { orpc, client } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

/**
 * Recomendações do pedido — formato de criativo, verba, destino e prazo.
 * A primeira leitura gera; `regenerate` força uma nova rodada.
 */
export const useTrafegoRecommendations = (
  orderId: string,
  options?: { enabled?: boolean },
) => {
  return useQuery({
    ...orpc.trafego.recommendations.get.queryOptions({
      input: { orderId, refresh: false },
    }),
    enabled: (options?.enabled ?? true) && Boolean(orderId),
    staleTime: 5 * 60 * 1000,
  });
};

export const useRegenerateTrafegoRecommendations = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { orderId: string }) =>
      client.trafego.recommendations.get({ ...input, refresh: true }),
    onSuccess: (data, variables) => {
      queryClient.setQueryData(
        orpc.trafego.recommendations.get.key({
          input: { orderId: variables.orderId, refresh: false },
        }),
        data,
      );
    },
  });
};

export const useSuggestTrafegoCopies = () => {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.trafego.copies.suggest.mutationOptions({
      onSuccess: (_data, variables) => {
        queryClient.invalidateQueries({
          queryKey: orpc.trafego.getOrder.key({ input: { orderId: variables.orderId } }),
        });
      },
    }),
  );
};
