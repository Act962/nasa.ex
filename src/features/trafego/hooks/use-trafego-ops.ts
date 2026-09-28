import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

/**
 * Operação do trafeGO no card do lead. Disponível para admin do sistema e para
 * participantes do tracking de operação — o servidor é quem decide.
 */
export const useTrafegoLeadSummary = (leadId: string, options?: { enabled?: boolean }) => {
  return useQuery({
    ...orpc.trafego.ops.getLeadSummary.queryOptions({ input: { leadId } }),
    enabled: (options?.enabled ?? true) && Boolean(leadId),
    // Lead comum devolve null e 403 para quem não é da operação: repetir não ajuda.
    retry: false,
  });
};

export const useTrafegoPendingPix = (
  filter: { search?: string; includeExpired?: boolean } = {},
) => {
  return useQuery({
    ...orpc.trafego.ops.listPendingPix.queryOptions({
      input: { includeExpired: filter.includeExpired ?? true, search: filter.search },
    }),
    retry: false,
  });
};

/**
 * Pergunta ao Asaas o estado das cobranças abertas e confirma o que já foi
 * pago. Roda no request, sem Inngest — é a saída quando a fila está fora.
 */
export const useReconcileTrafegoPix = () => {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.trafego.ops.reconcilePix.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.trafego.ops.listPendingPix.key(),
        });
      },
    }),
  );
};

export const useConfirmTrafegoPix = (leadId?: string) => {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.trafego.ops.confirmPix.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: orpc.trafego.ops.listPendingPix.key() });
        if (leadId) {
          queryClient.invalidateQueries({
            queryKey: orpc.trafego.ops.getLeadSummary.key({ input: { leadId } }),
          });
        }
      },
    }),
  );
};
