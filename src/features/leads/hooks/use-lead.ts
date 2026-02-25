import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const useCreateLead = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.leads.create.mutationOptions({
      onSuccess: (data) => {
        toast.success("Lead criada com sucesso!");

        queryClient.invalidateQueries({
          queryKey: [
            "leads.listLeadsByStatus",
            data.lead.statusId,
            data.lead.trackingId,
          ],
        });
        queryClient.invalidateQueries({
          queryKey: orpc.status.getMany.queryKey({
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
    }),
  );
};

export const userMoveToFirst = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.leads.addToFirst.mutationOptions({
      onSuccess: (data) => {
        toast.success(`${data.leadName} movido para o início da coluna`);

        queryClient.invalidateQueries(
          orpc.status.getMany.queryOptions({
            input: {
              trackingId: data.trackingId,
            },
          }),
        );
      },
    }),
  );
};

export const useMoveToLast = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.leads.addToLast.mutationOptions({
      onSuccess: (data) => {
        toast.success(`${data.leadName} movido para o fim da coluna`);

        queryClient.invalidateQueries(
          orpc.status.getMany.queryOptions({
            input: {
              trackingId: data.trackingId,
            },
          }),
        );
      },
    }),
  );
};

// export const useUpdateOrder = () => {
//   return useMutation(
//     orpc.leads.updateOrder.mutationOptions({
//       onSuccess: () => {
//         toast.success("Lead atualizada com sucesso!");
//       },
//       onError: () => {
//         toast.error("Erro ao atualizar lead, tente novamente mais tarde");
//         // Reverte o estado em caso de erro
//         // setStatusData(status);
//       },
//     }),
//   );
// };

export const useQueryLead = (leadId: string) => {
  const { data, isLoading } = useQuery(
    orpc.leads.get.queryOptions({
      input: {
        id: leadId,
      },
    }),
  );

  return {
    data,
    isLoading,
  };
};

export const useListHistoric = (leadId: string) => {
  const { data, isLoading } = useQuery(
    orpc.leads.listHistoric.queryOptions({
      input: {
        leadId,
      },
    }),
  );

  return {
    data,
    isLoading,
  };
};
