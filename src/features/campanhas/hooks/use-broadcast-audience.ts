import { orpc } from "@/lib/orpc";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

/**
 * Hooks de audiência de uma campanha: adicionar destinatários (leads/CSV),
 * listar (paginado) e remover. Mutations invalidam a lista de destinatários +
 * o detalhe da campanha (contadores mudam).
 */

function useInvalidateAudience(broadcastId: string) {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({
      queryKey: orpc.campanhas.listRecipients.key({ input: { broadcastId } }),
    });
    queryClient.invalidateQueries({
      queryKey: orpc.campanhas.get.key({ input: { id: broadcastId } }),
    });
  };
}

export const useAddRecipientsFromLeads = (broadcastId: string) => {
  const invalidate = useInvalidateAudience(broadcastId);
  return useMutation(
    orpc.campanhas.addRecipientsFromLeads.mutationOptions({
      onSuccess: invalidate,
    }),
  );
};

export const useAddRecipientsFromCsv = (broadcastId: string) => {
  const invalidate = useInvalidateAudience(broadcastId);
  return useMutation(
    orpc.campanhas.addRecipientsFromCsv.mutationOptions({
      onSuccess: invalidate,
    }),
  );
};

export const useRemoveRecipient = (broadcastId: string) => {
  const invalidate = useInvalidateAudience(broadcastId);
  return useMutation(
    orpc.campanhas.removeRecipient.mutationOptions({
      onSuccess: invalidate,
    }),
  );
};

export const useBroadcastRecipients = (
  broadcastId: string,
  status?:
    | "PENDING"
    | "QUEUED"
    | "SENT"
    | "DELIVERED"
    | "READ"
    | "FAILED"
    | "SKIPPED",
) => {
  return useInfiniteQuery({
    ...orpc.campanhas.listRecipients.infiniteOptions({
      input: (cursor: string | undefined) => ({
        broadcastId,
        status,
        cursor,
        limit: 50,
      }),
      initialPageParam: undefined as string | undefined,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    }),
  });
};
