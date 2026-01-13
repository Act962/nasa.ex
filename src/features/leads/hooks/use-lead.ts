import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const useCreateLead = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.leads.create.mutationOptions({
      onSuccess: (data) => {
        toast.success("Lead criada com sucesso!");

        queryClient.invalidateQueries({
          queryKey: orpc.status.list.queryKey({
            input: { trackingId: data.lead.trackingId },
          }),
        });

        queryClient.invalidateQueries({
          queryKey: orpc.leads.search.queryKey({
            input: { trackingId: data.lead.trackingId },
          }),
        });

        queryClient.invalidateQueries({
          queryKey: orpc.leads.list.queryKey(),
        });
      },
      onError: () => {
        toast.error("Erro ao criar lead, tente novamente");
      },
    })
  );
};

export const userMoveToFirst = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.leads.addToFirst.mutationOptions({
      onSuccess: (data) => {
        toast.success(`${data.leadName} movido para o início da coluna`);

        queryClient.invalidateQueries(
          orpc.status.list.queryOptions({
            input: {
              trackingId: data.trackingId,
            },
          })
        );
      },
    })
  );
};

export const useMoveToLast = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.leads.addToLast.mutationOptions({
      onSuccess: (data) => {
        toast.success(`${data.leadName} movido para o fim da coluna`);

        queryClient.invalidateQueries(
          orpc.status.list.queryOptions({
            input: {
              trackingId: data.trackingId,
            },
          })
        );
      },
    })
  );
};

export const useUpdateOrder = () => {
  return useMutation(
    orpc.leads.updateOrder.mutationOptions({
      onSuccess: () => {
        toast.success("Lead atualizada com sucesso!");
      },
      onError: () => {
        toast.error("Erro ao atualizar lead, tente novamente mais tarde");
        // Reverte o estado em caso de erro
        // setStatusData(status);
      },
    })
  );
};
