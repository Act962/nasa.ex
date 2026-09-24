"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

function useInvalidateChannel() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: orpc.comments.key() });
}

export function useCommentsChannel() {
  return useQuery(orpc.comments.channel.get.queryOptions({ input: {} }));
}

export function useConnectCommentsChannel() {
  const invalidate = useInvalidateChannel();
  return useMutation(
    orpc.comments.channel.connect.mutationOptions({ onSuccess: invalidate }),
  );
}

export function useDisconnectCommentsChannel() {
  const invalidate = useInvalidateChannel();
  return useMutation(
    orpc.comments.channel.disconnect.mutationOptions({ onSuccess: invalidate }),
  );
}

/**
 * Reinscreve o app nos eventos da conta. Assinar os campos no painel da Meta
 * não basta — sem isto a conta não entrega nada.
 */
export function useRepairCommentsSubscription() {
  const invalidate = useInvalidateChannel();
  return useMutation(
    orpc.comments.channel.repairSubscription.mutationOptions({
      onSuccess: invalidate,
    }),
  );
}

export function useReactivateCommentsChannel() {
  const invalidate = useInvalidateChannel();
  return useMutation(
    orpc.comments.channel.reactivate.mutationOptions({ onSuccess: invalidate }),
  );
}

export function useCommentsContent(enabled = true) {
  return useQuery({
    ...orpc.comments.channel.listContent.queryOptions({ input: {} }),
    enabled,
  });
}
