import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const ORDER_REFRESH_MS = 10_000;
const MESSAGES_REFRESH_MS = 4_000;

export function useCatalogOrderPortal(token: string) {
  return useQuery(
    orpc.public.catalogOrder.get.queryOptions({
      input: { token },
      refetchInterval: ORDER_REFRESH_MS,
    }),
  );
}

export function useCatalogOrderMessages(token: string) {
  return useQuery(
    orpc.public.catalogOrder.listMessages.queryOptions({
      input: { token },
      refetchInterval: MESSAGES_REFRESH_MS,
    }),
  );
}

export function useSendCatalogOrderMessage(token: string) {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.public.catalogOrder.sendMessage.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.public.catalogOrder.listMessages.queryKey({ input: { token } }),
        });
      },
    }),
  );
}

export function useCatalogOrderStarFriends(token: string) {
  return useQuery(orpc.public.catalogOrder.starFriends.queryOptions({ input: { token } }));
}

export function useRequestCatalogOrderRedemption(token: string) {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.public.catalogOrder.requestRedemption.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.public.catalogOrder.starFriends.queryKey({ input: { token } }),
        });
      },
    }),
  );
}

export function useCatalogOrderCustomerOrders(token: string, enabled = true) {
  return useQuery(orpc.public.catalogOrder.customerOrders.queryOptions({ input: { token }, enabled }));
}

export function usePayCatalogOrderWithPix(token: string) {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.public.catalogOrder.payWithPix.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.public.catalogOrder.get.queryKey({ input: { token } }),
        });
      },
    }),
  );
}
