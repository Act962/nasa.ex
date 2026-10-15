import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useSendCatalogOrderQuote() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.nerp.catalogOrders.sendQuote.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: orpc.leads.listProducts.key() });
      },
    }),
  );
}

export function useConfirmCatalogOrderPayment() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.nerp.catalogOrders.confirmPayment.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: orpc.leads.listProducts.key() });
      },
    }),
  );
}
