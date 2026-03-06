import { useQueryTags } from "@/features/tags/hooks/use-tags";
import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useMutationUpdateLeads() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.leads.updateManyStatus.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: ["leads.listLeadsByStatus"],
        });
        toast.success("Lead atualizado");
      },
      onError: () => {
        toast.error("Erro ao atualizar lead");
      },
    }),
  );
}

export const useAddTags = () => {
  return useMutation(
    orpc.leads.addTags.mutationOptions({
      onSuccess: () => {
        toast.success("Tags adicionadas com sucesso");
      },
      onError: () => {
        toast.error("Erro ao adicionar tags");
      },
    }),
  );
};

export function useAddTagsOptimistic({
  leadId,
  trackingId,
}: {
  leadId: string;
  trackingId: string;
}) {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.leads.addTags.mutationOptions({
      onMutate: async (newTagData: { leadId: string; tagIds: string[] }) => {
        const queryKey = orpc.tags.getTagByLead.queryKey({
          input: { leadId },
        });

        await queryClient.cancelQueries({ queryKey });

        const previousTags = queryClient.getQueryData<any>(queryKey);

        const allTags = queryClient.getQueryData<any>(
          orpc.tags.listTags.queryKey({
            input: { query: { trackingId } },
          }),
        );

        queryClient.setQueryData(queryKey, (old: any) => {
          const currentTags = old?.tags || [];

          const addedTags =
            allTags?.tags?.filter((t: any) =>
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
      onSettled: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.tags.getTagByLead.queryKey({
            input: { leadId },
          }),
        });
      },
    }),
  );
}

export function useRemoveTagOptimistic({ leadId }: { leadId: string }) {
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
      // onSuccess: () => {
      //   toast.success("Tag removida com sucesso");
      // },
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
}
