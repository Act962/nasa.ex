import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useTags({ trackingId }: { trackingId?: string }) {
  const { data, isLoading } = useQuery(
    orpc.tags.listTags.queryOptions({
      input: {
        query: {
          trackingId,
        },
      },
    }),
  );

  return {
    tags: data?.tags || [],
    isLoadingTags: isLoading,
  };
}

export function useQueryTags({ trackingId }: { trackingId?: string }) {
  const { data, isLoading } = useQuery(
    orpc.tags.listTags.queryOptions({
      input: {
        query: {
          trackingId,
        },
      },
    }),
  );

  return {
    tags: data?.tags || [],
    isLoadingTags: isLoading,
  };
}

export function useMutationWhatsappTags({
  trackingId,
}: {
  trackingId?: string;
}) {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.leads.updateWhatsappTags.mutationOptions({
      onSuccess: () => {
        // Invalida a lista de tags global
        queryClient.invalidateQueries({
          queryKey: orpc.tags.listTags.queryKey({
            input: {
              query: {
                trackingId,
              },
            },
          }),
        });

        // Invalida a lista de conversas para atualizar as tags do lead na sidebar
        queryClient.invalidateQueries({
          queryKey: ["conversations.list"],
        });

        // Também invalida queries de leads em geral para garantir que detalhes do lead sejam atualizados
        queryClient.invalidateQueries({
          queryKey: ["leads", "get"],
        });
      },
    }),
  );
}
