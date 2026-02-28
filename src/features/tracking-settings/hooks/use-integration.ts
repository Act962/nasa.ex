import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const useCreateIntegration = ({
  trackingId,
}: {
  trackingId: string;
}) => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.integrations.create.mutationOptions({
      onSuccess: () => {
        toast.success("Integração criada com sucesso!");
        queryClient.invalidateQueries({
          queryKey: orpc.integrations.get.queryKey({
            input: { trackingId },
          }),
        });
      },
      onError: () => {
        toast.error("Erro ao criar integração!");
      },
    }),
  );
};

export const useConnectIntegrationStatus = (trackingId: string) => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.integrations.connect.mutationOptions({
      onSuccess: () => {
        toast.success("Integração atualizada com sucesso!");
        queryClient.invalidateQueries({
          queryKey: orpc.integrations.get.queryKey({
            input: { trackingId },
          }),
        });
        queryClient.invalidateQueries({
          queryKey: orpc.conversation.list.queryKey({
            input: { trackingId: trackingId, search: null, statusId: null },
          }),
        });
      },
      onError: () => {
        toast.error("Erro ao conectar integração!");
      },
    }),
  );
};

export const useDisconnectIntegrationStatus = (trackingId: string) => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.integrations.disconnect.mutationOptions({
      onSuccess: () => {
        toast.success("Integração desconectada com sucesso!");
        queryClient.invalidateQueries({
          queryKey: orpc.integrations.get.queryKey({
            input: { trackingId },
          }),
        });
      },
      onError: () => {
        toast.error("Erro ao desconectar integração!");
      },
    }),
  );
};

export const useQueryInstances = (trackingId: string) => {
  const { data, isLoading } = useQuery(
    orpc.integrations.get.queryOptions({
      input: { trackingId },
    }),
  );

  return { instance: data ?? null, instanceLoading: isLoading };
};

export const useDeleteIntegration = ({
  trackingId,
}: {
  trackingId: string;
}) => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.integrations.delete.mutationOptions({
      onSuccess: () => {
        toast.success("Integração deletada com sucesso!");
        queryClient.invalidateQueries({
          queryKey: orpc.integrations.get.queryKey({
            input: { trackingId },
          }),
        });
      },
      onError: () => {
        toast.error("Erro ao deletar integração!");
      },
    }),
  );
};
