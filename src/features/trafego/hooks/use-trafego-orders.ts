import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

/**
 * Pedidos do painel do cliente. Mutations invalidam lista e detalhe por
 * default; toasts e navegação ficam no componente via `mutate(..., {...})`.
 */

export const useTrafegoOrders = () => {
  return useQuery(orpc.trafego.listOrders.queryOptions({ input: {} }));
};

export const useTrafegoOrder = (orderId: string, options?: { enabled?: boolean }) => {
  return useQuery({
    ...orpc.trafego.getOrder.queryOptions({ input: { orderId } }),
    enabled: (options?.enabled ?? true) && Boolean(orderId),
  });
};

export const useTrafegoOrderPerformance = (
  orderId: string,
  days = 30,
  options?: { enabled?: boolean },
) => {
  return useQuery({
    ...orpc.trafego.getOrderPerformance.queryOptions({ input: { orderId, days } }),
    enabled: (options?.enabled ?? true) && Boolean(orderId),
  });
};

function useOrderInvalidation() {
  const queryClient = useQueryClient();
  return (orderId: string) => {
    queryClient.invalidateQueries({ queryKey: orpc.trafego.listOrders.key() });
    queryClient.invalidateQueries({
      queryKey: orpc.trafego.getOrder.key({ input: { orderId } }),
    });
  };
}

export const useUpdateTrafegoBriefing = () => {
  const invalidate = useOrderInvalidation();
  return useMutation(
    orpc.trafego.updateBriefing.mutationOptions({
      onSuccess: (_data, variables) => invalidate(variables.orderId),
    }),
  );
};

export const useActivateTrafegoOrder = () => {
  const invalidate = useOrderInvalidation();
  return useMutation(
    orpc.trafego.activateOrder.mutationOptions({
      onSuccess: (_data, variables) => invalidate(variables.orderId),
    }),
  );
};

export const useAddTrafegoCreative = () => {
  const invalidate = useOrderInvalidation();
  return useMutation(
    orpc.trafego.creatives.add.mutationOptions({
      onSuccess: (_data, variables) => invalidate(variables.orderId),
    }),
  );
};

export const useRemoveTrafegoCreative = (orderId: string) => {
  const invalidate = useOrderInvalidation();
  return useMutation(
    orpc.trafego.creatives.remove.mutationOptions({
      onSuccess: () => invalidate(orderId),
    }),
  );
};

export const useAddTrafegoCopy = () => {
  const invalidate = useOrderInvalidation();
  return useMutation(
    orpc.trafego.copies.add.mutationOptions({
      onSuccess: (_data, variables) => invalidate(variables.orderId),
    }),
  );
};

export const useUpdateTrafegoCopy = (orderId: string) => {
  const invalidate = useOrderInvalidation();
  return useMutation(
    orpc.trafego.copies.update.mutationOptions({
      onSuccess: () => invalidate(orderId),
    }),
  );
};

export const useSetTrafegoCopySelected = (orderId: string) => {
  const invalidate = useOrderInvalidation();
  return useMutation(
    orpc.trafego.copies.setSelected.mutationOptions({
      onSuccess: () => invalidate(orderId),
    }),
  );
};

export const useRemoveTrafegoCopy = (orderId: string) => {
  const invalidate = useOrderInvalidation();
  return useMutation(
    orpc.trafego.copies.remove.mutationOptions({
      onSuccess: () => invalidate(orderId),
    }),
  );
};
