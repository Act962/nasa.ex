import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface UseCreateStatusOptions {
  trackingId: string;
  onSuccess?: () => void;
}

export const useCreateStatus = ({
  trackingId,
  onSuccess,
}: UseCreateStatusOptions) => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.status.create.mutationOptions({
      onSuccess: () => {
        toast.success("Status criado com sucesso!");

        queryClient.invalidateQueries({
          queryKey: orpc.status.list.queryKey({
            input: {
              trackingId,
            },
          }),
        });

        onSuccess?.();
      },
      onError: () => {
        toast.error("Erro ao criar status, tente novamente");
      },
    })
  );
};
