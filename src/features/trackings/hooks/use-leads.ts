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
  const queryClient = useQueryClient();

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
