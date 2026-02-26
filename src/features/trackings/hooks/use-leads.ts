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
  const { tags } = useQueryTags({ trackingId });

  const addTags = useMutation(
    orpc.leads.addTags.mutationOptions({
      onMutate: async (newTagData: { leadId: string; tagIds: string[] }) => {
        const queryKey = ["leads.listLeadsByStatus"];

        await queryClient.cancelQueries({ queryKey });

        const previousData = queryClient.getQueriesData({ queryKey });

        queryClient.setQueriesData({ queryKey }, (oldData: any) => {
          if (!oldData || !oldData.pages) return oldData;

          const newPages = oldData.pages.map((page: any) => ({
            ...page,
            leads: page.leads.map((lead: any) => {
              if (lead.id === leadId) {
                const selectedTags = tags?.filter((t) =>
                  newTagData.tagIds.includes(t.id),
                );

                const existingIds =
                  lead.leadTags?.map((lt: any) => lt.tag.id) || [];
                const tagsToAdd =
                  selectedTags?.filter((t) => !existingIds.includes(t.id)) ||
                  [];

                return {
                  ...lead,
                  leadTags: [
                    ...(lead.leadTags || []),
                    ...tagsToAdd.map((tag) => ({ tag })),
                  ],
                };
              }
              return lead;
            }),
          }));

          return {
            ...oldData,
            pages: newPages,
          };
        });

        return { previousData };
      },
      onSuccess: () => {
        toast.success("Tag adicionada com sucesso");
      },
      onError: (err, _, context) => {
        if (context?.previousData) {
          context.previousData.forEach(([queryKey, data]) => {
            queryClient.setQueryData(queryKey, data);
          });
        }
        toast.error("Erro ao adicionar tags");
      },
      onSettled: () => {
        queryClient.invalidateQueries({
          queryKey: ["leads.listLeadsByStatus"],
        });
      },
    }),
  );

  return { addTags };
}
