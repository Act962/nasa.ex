import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useMutationLeadUpdate(leadId: string, trackingId: string) {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.leads.update.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.leads.get.queryKey({
            input: { id: leadId },
          }),
        });
        queryClient.invalidateQueries({
          queryKey: orpc.leads.list.queryKey(),
        });
        queryClient.invalidateQueries({
          queryKey: ["conversations.list", trackingId],
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
