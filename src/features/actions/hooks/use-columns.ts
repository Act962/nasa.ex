import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const useCreateColumn = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.column.create.mutationOptions({
      onSuccess: (data) => {
        toast.success(`Coluna ${data.columnName} criada com sucesso!`);
        queryClient.invalidateQueries(
          orpc.workspace.getColumnsByWorkspace.queryOptions({
            input: {
              workspaceId: data.workspaceId,
            },
          }),
        );
      },
      onError: () => {
        toast.error("Erro ao criar coluna!");
      },
    }),
  );
};

export const useUpdateColumn = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.column.update.mutationOptions({
      onSuccess: (data) => {
        toast.success("Coluna atualizada com sucesso!");
        queryClient.invalidateQueries(
          orpc.workspace.getColumnsByWorkspace.queryOptions({
            input: {
              workspaceId: data.workspaceId,
            },
          }),
        );
      },
      onError: () => {
        toast.error("Erro ao atualizar coluna!");
      },
    }),
  );
};

export const useDeleteColumn = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.column.delete.mutationOptions({
      onSuccess: (data) => {
        toast.success("Coluna deletada com sucesso!");
        queryClient.invalidateQueries(
          orpc.workspace.getColumnsByWorkspace.queryOptions({
            input: {
              workspaceId: data.workspaceId,
            },
          }),
        );
      },
      onError: () => {
        toast.error("Erro ao deletar coluna!");
      },
    }),
  );
};

export const useUpdateColumnOrder = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.column.updateNewOrder.mutationOptions({
      onSuccess: (data) => {
        queryClient.invalidateQueries(
          orpc.workspace.getColumnsByWorkspace.queryOptions({
            input: {
              workspaceId: data.workspaceId,
            },
          }),
        );
      },
      onError: () => {
        toast.error("Erro ao reordenar coluna!");
      },
    }),
  );
};
