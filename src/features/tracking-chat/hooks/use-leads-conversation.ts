import { orpc } from "@/lib/orpc";
import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { toast } from "sonner";

export function useSuspenseLeadsByWhats() {
  return useSuspenseQuery(orpc.leads.listLeadByWhats.queryOptions({}));
}

export function useQueryLeadsByWhats() {
  const { data, isLoading } = useQuery(
    orpc.leads.listLeadByWhats.queryOptions({}),
  );
  return { data, isLoading };
}

export function useQueryLeadsWithoutConversation(trackingId: string) {
  const { data, isLoading } = useQuery(
    orpc.leads.listLeadWithoutConversation.queryOptions({
      input: { trackingId },
    }),
  );
  return { customers: data?.customers, isLoading };
}

export const useQueryTagByLead = (leadId: string, initialTags?: any[]) => {
  const { data, isLoading } = useQuery({
    ...orpc.tags.getTagByLead.queryOptions({
      input: { leadId },
    }),
    initialData: initialTags ? { leadId, tags: initialTags } : undefined,
    staleTime: 1000 * 60 * 30, // 30 minutos
  });
  return {
    tags: data?.tags || [],
    isLoading,
  };
};

export const useAddTagToLeadOptimistic = (
  leadId: string,
  trackingId?: string,
) => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.leads.addTags.mutationOptions({
      onMutate: async (newTagData: { leadId: string; tagIds: string[] }) => {
        const queryKey = orpc.tags.getTagByLead.queryKey({
          input: { leadId },
        });

        await queryClient.cancelQueries({ queryKey });

        const previousTags = queryClient.getQueryData<any>(queryKey);

        const allTagsKey = orpc.tags.listTags.queryKey({
          input: { query: { trackingId } },
        });
        const allTagsData = queryClient.getQueryData<any>(allTagsKey);

        // Fallback to searching all listTags queries if exact key fails
        const tagsFromCache =
          allTagsData?.tags ||
          queryClient
            .getQueriesData<any>({ queryKey: ["tags", "listTags"] })
            .find(([_, data]) => data?.tags)?.[1]?.tags ||
          [];

        queryClient.setQueryData(queryKey, (old: any) => {
          const currentTags = old?.tags || [];

          const addedTags =
            tagsFromCache.filter((t: any) =>
              newTagData.tagIds.includes(t.id),
            ) || [];

          const existingIds = currentTags.map((t: any) => t.id);
          const uniqueAddedTags = addedTags.filter(
            (t: any) => !existingIds.includes(t.id),
          );

          return {
            ...old,
            tags: [...currentTags, ...uniqueAddedTags],
          };
        });

        return { previousTags };
      },
      onError: (err, _, context) => {
        const queryKey = orpc.tags.getTagByLead.queryKey({
          input: { leadId },
        });
        if (context?.previousTags) {
          queryClient.setQueryData(queryKey, context.previousTags);
        }
        toast.error("Erro ao adicionar tags");
      },
      // onSuccess: () => {
      //   toast.success("Tags adicionadas com sucesso");
      // },
      onSettled: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.tags.getTagByLead.queryKey({
            input: { leadId },
          }),
        });
      },
    }),
  );
};

export const useRemoveTagFromLeadOptimistic = (leadId: string) => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.leads.removeTags.mutationOptions({
      onMutate: async (data: { leadId: string; tagIds: string[] }) => {
        const queryKey = orpc.tags.getTagByLead.queryKey({
          input: { leadId },
        });

        await queryClient.cancelQueries({ queryKey });

        const previousTags = queryClient.getQueryData<any>(queryKey);

        queryClient.setQueryData(queryKey, (old: any) => {
          const currentTags = old?.tags || [];
          return {
            ...old,
            tags: currentTags.filter((t: any) => !data.tagIds.includes(t.id)),
          };
        });

        return { previousTags };
      },
      onSuccess: () => {
        toast.success("Tag removida com sucesso");
      },
      onError: (err, _, context) => {
        const queryKey = orpc.tags.getTagByLead.queryKey({
          input: { leadId },
        });
        if (context?.previousTags) {
          queryClient.setQueryData(queryKey, context.previousTags);
        }
        toast.error("Erro ao remover tags");
      },
      onSettled: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.tags.getTagByLead.queryKey({
            input: { leadId },
          }),
        });
      },
    }),
  );
};
