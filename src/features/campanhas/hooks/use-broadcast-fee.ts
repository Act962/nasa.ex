import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

/** Taxa ÓRBITA por campanha (spec 0040): cotação, checkout e confirmação. */

export const useBroadcastFeeQuote = (broadcastId: string, options?: { enabled?: boolean }) => {
  return useQuery({
    ...orpc.campanhas.quoteFee.queryOptions({ input: { broadcastId } }),
    enabled: options?.enabled ?? true,
  });
};

export const useCheckoutBroadcastFee = () => {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.campanhas.checkoutFee.mutationOptions({
      onSuccess: (_result, input) => {
        queryClient.invalidateQueries({ queryKey: orpc.campanhas.quoteFee.key({ input: { broadcastId: input.broadcastId } }) });
      },
    }),
  );
};

export const useConfirmBroadcastFee = () => {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.campanhas.confirmFee.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: orpc.campanhas.quoteFee.key() });
        queryClient.invalidateQueries({ queryKey: orpc.campanhas.get.key() });
        queryClient.invalidateQueries({ queryKey: orpc.campanhas.list.key() });
      },
    }),
  );
};

export const useBroadcastFeeSettings = (options?: { enabled?: boolean }) => {
  return useQuery({ ...orpc.campanhas.getFeeSettings.queryOptions(), enabled: options?.enabled ?? true });
};

export const useUpdateBroadcastFeeSettings = () => {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.campanhas.updateFeeSettings.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: orpc.campanhas.getFeeSettings.key() });
      },
    }),
  );
};
