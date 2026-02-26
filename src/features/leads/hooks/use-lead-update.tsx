import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useMutationLeadUpdate(leadId: string) {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.leads.update.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.leads.get.queryKey({
            input: { id: leadId },
          }),
        });
        toast.success(`Lead atualizado com sucesso`, {
          position: "bottom-right",
        });
      },
      onError: () => {
        toast.error(`Erro ao atualizar lead`, {
          position: "bottom-right",
        });
      },
    }),
  );
}
