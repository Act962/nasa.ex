import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const useCreateIntegration = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.integrations.create.mutationOptions({
      onSuccess: () => {
        toast.success("Integração criada com sucesso!");
        // queryClient.invalidateQueries({
        //     queryKey: orpc.integrations.list.queryKey(),
        // })
      },
      onError: () => {
        toast.error("Erro ao criar integração!");
      },
    }),
  );
};
