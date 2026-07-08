import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

/**
 * Hooks CRUD das campanhas (broadcasts). Mutations invalidam a lista/detalhe
 * por default; toasts e redirects ficam no componente via `mutate(..., {...})`.
 */

export const useBroadcasts = () => {
  return useQuery(orpc.campanhas.list.queryOptions());
};

export const useBroadcast = (id: string, options?: { enabled?: boolean }) => {
  return useQuery({
    ...orpc.campanhas.get.queryOptions({ input: { id } }),
    enabled: options?.enabled ?? true,
  });
};

export const useCreateBroadcast = () => {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.campanhas.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: orpc.campanhas.list.key() });
      },
    }),
  );
};

export const useUpdateBroadcast = () => {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.campanhas.update.mutationOptions({
      onSuccess: (updated) => {
        queryClient.invalidateQueries({ queryKey: orpc.campanhas.list.key() });
        queryClient.invalidateQueries({
          queryKey: orpc.campanhas.get.key({ input: { id: updated.id } }),
        });
      },
    }),
  );
};

export const useDeleteBroadcast = () => {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.campanhas.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: orpc.campanhas.list.key() });
      },
    }),
  );
};
