import { orpc } from "@/lib/orpc";
import { getQueryClient } from "@/lib/query/hydration";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

export function useMutationLeadUpdate(leadId: string) {
  const queryClient = getQueryClient();

  return useMutation(
    orpc.leads.update.mutationOptions({
      onSuccess: () => {
        toast.success(`Lead atualizado com sucesso`);
        queryClient.invalidateQueries({
          queryKey: orpc.leads.get.queryKey({
            input: { id: leadId },
          }),
        });
      },
      onError: () => {
        toast.error(`Erro ao atualizar lead`);
      },
    }),
  );
}
