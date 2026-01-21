import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const useCreateTracking = () => {
  const queryClient = useQueryClient();
  const trpc = useTRPC();

  return useMutation(
    trpc.trackings.create.mutationOptions({
      onSuccess: (data) => {
        toast.success(`Tracking ${data.name} criado com sucesso`);
        queryClient.invalidateQueries(trpc.trackings.getMany.queryOptions());
      },
      onError: (error) => {
        toast.error("Erro ao criar tracking: " + error.message);
      },
    }),
  );
};
