import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useTags({ trackingId }: { trackingId?: string }) {
  const { data, isLoading } = useQuery(
    orpc.tags.listTags.queryOptions({
      input: {
        query: {
          trackingId: trackingId === "ALL" ? undefined : trackingId,
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
          trackingId: trackingId === "ALL" ? undefined : trackingId,
        },
      },
    }),
  );

  return {
    tags: data?.tags || [],
    isLoadingTags: isLoading,
  };
}
export function useQueryWithoutWidgetTags({
  organizationIds,
}: {
  organizationIds: string[];
}) {
  const { data, isLoading } = useQuery(
    orpc.tags.listTagsWithoutWidget.queryOptions({
      input: {
        organizationIds,
      },
    }),
  );

  return {
    tags: data?.tags || [],
    isLoadingTags: isLoading,
  };
}

export function useDeleteTag() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.tags.deleteTag.mutationOptions({
      onSuccess: (data) => {
        // Invalida a lista de tags global
        // Invalida a query específica do funil
        queryClient.invalidateQueries({
          queryKey: orpc.tags.listTags.queryKey({
            input: { query: { trackingId: data.trackingId ?? undefined } },
          }),
        });

        // Invalida a query geral da organização (usada no dashboard)
        queryClient.invalidateQueries({
          queryKey: orpc.tags.listTags.queryKey({
            input: { query: { trackingId: undefined } },
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

export function useUpdateTag() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.tags.updateTag.mutationOptions({
      onSuccess: (data) => {
        // Invalida a lista de tags global
        // Invalida a query específica do funil
        queryClient.invalidateQueries({
          queryKey: orpc.tags.listTags.queryKey({
            input: { query: { trackingId: data.trackingId ?? undefined } },
          }),
        });

        // Invalida a query geral da organização (usada no dashboard)
        queryClient.invalidateQueries({
          queryKey: orpc.tags.listTags.queryKey({
            input: { query: { trackingId: undefined } },
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
