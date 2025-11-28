import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface UseCreateLeadOptions {
  trackingId: string;
  onSuccess?: () => void;
}

export const useCreateLead = ({
  trackingId,
  onSuccess,
}: UseCreateLeadOptions) => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.leads.create.mutationOptions({
      onSuccess: () => {
        toast.success("Lead criada com sucesso!");

        queryClient.invalidateQueries({
          queryKey: orpc.status.list.queryKey({
            input: { trackingId },
          }),
        });

        queryClient.invalidateQueries({
          queryKey: orpc.leads.search.queryKey({
            input: { trackingId },
          }),
        });

        queryClient.invalidateQueries({
          queryKey: orpc.leads.list.queryKey(),
        });

        onSuccess?.();
      },
      onError: () => {
        toast.error("Erro ao criar lead, tente novamente");
      },
    })
  );
};
