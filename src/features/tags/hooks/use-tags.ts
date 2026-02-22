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

        queryClient.invalidateQueries({
          queryKey: ["conversations.list"],
        });

        queryClient.invalidateQueries({
          queryKey: ["leads", "get"],
        });
      },
    }),
  );
}
