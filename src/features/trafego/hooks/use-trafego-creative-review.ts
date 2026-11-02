import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

/** Análise do criativo pelo Astro (spec 0126). Com pedido, a análise fica guardada no criativo. */
export const useAnalyzeTrafegoCreative = () => {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.trafego.creativeReview.analyze.mutationOptions({
      onSuccess: (_review, variables) => {
        if (!variables.orderId) return;
        queryClient.invalidateQueries({ queryKey: orpc.trafego.getOrder.key({ input: { orderId: variables.orderId } }) });
      },
    }),
  );
};

/** Números da conta Meta da org para os avisos do passo a passo (spec 0129, RF-3). Cache de 15 min no servidor. */
export const useTrafegoWizardAccountSummary = ({ enabled }: { enabled: boolean }) =>
  useQuery({
    ...orpc.trafego.creativeReview.accountSummary.queryOptions(),
    enabled,
    staleTime: 15 * 60 * 1000,
    retry: false,
  });

/** Botão "Gere com IA" do passo Criativo (spec 0130, RF-1): texto, título e mensagem inicial. */
export const useSuggestTrafegoAdCopy = () => useMutation(orpc.trafego.creativeReview.suggestCopy.mutationOptions());
