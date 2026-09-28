import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export const useTrafegoMessages = (
  orderId: string,
  options?: { enabled?: boolean; refetchInterval?: number | false },
) => {
  return useQuery({
    ...orpc.trafego.support.list.queryOptions({ input: { orderId } }),
    enabled: (options?.enabled ?? true) && Boolean(orderId),
    refetchInterval: options?.refetchInterval,
  });
};

export const useSendTrafegoMessage = (orderId: string) => {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.trafego.support.send.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.trafego.support.list.key({ input: { orderId } }),
        });
      },
    }),
  );
};

export const useMarkTrafegoMessagesRead = () => {
  return useMutation(orpc.trafego.support.markRead.mutationOptions());
};
