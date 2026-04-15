import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useSpacePointCtx } from "@/features/space-point";

export function useMutationLeadUpdate(leadId: string, trackingId: string) {
  const queryClient = useQueryClient();
  const { earn } = useSpacePointCtx();

  return useMutation(
    orpc.leads.update.mutationOptions({
      onSuccess: (data) => {
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
        queryClient.invalidateQueries({
          queryKey: orpc.status.getMany.queryKey({
            input: { trackingId: data.lead.trackingId },
          }),
        });

        queryClient.invalidateQueries({
          queryKey: ["leads.listLeadsByStatus"],
        });

        earn("update_lead", "Lead editado ✏️");
      },
      onError: () => {
        toast.error(`Erro ao atualizar lead`, {
          position: "bottom-right",
        });
      },
    }),
  );
}
