import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

/** O que o Chatbot IA pode fazer pelo cliente (spec 0084). */
export function useAiCapabilities(trackingId: string) {
  return useQuery(orpc.ia.capabilities.get.queryOptions({ input: { trackingId } }));
}

export function useUpdateAiCapabilities() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.ia.capabilities.update.mutationOptions({
      onSuccess: (data) => {
        queryClient.invalidateQueries({
          queryKey: orpc.ia.capabilities.get.queryKey({ input: { trackingId: data.trackingId } }),
        });
      },
    }),
  );
}
