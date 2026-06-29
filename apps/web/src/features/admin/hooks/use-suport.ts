import { orpc } from "@/lib/orpc";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const useListSupportTickets = (page = 1, take = 10) => {
  const { data, isLoading } = useQuery(
    orpc.support.listSupportTickets.queryOptions({
      input: { page, take },
    }),
  );

  return { data, isLoading };
};

export const useUpdateSupportTicketStatus = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.support.updateSupportTicketStatus.mutationOptions({
      onSuccess: () => {
        toast.success("Status atualizado com sucesso!");
        queryClient.invalidateQueries({
          queryKey: orpc.support.listSupportTickets.key(),
        });
      },
      onError: () => {
        toast.error("Erro ao atualizar o status do ticket");
      },
    }),
  );
};
