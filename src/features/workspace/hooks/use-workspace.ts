import { orpc } from "@/lib/orpc";
import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { toast } from "sonner";

export const useSuspenseWokspaces = () => {
  return useSuspenseQuery(orpc.workspace.list.queryOptions());
};

export const useWorkspace = (workspaceId: string) => {
  return useQuery(
    orpc.workspace.get.queryOptions({
      input: { workspaceId },
      enabled: !!workspaceId,
    }),
  );
};

export const useSuspenseWorkspace = (workspaceId: string) => {
  return useSuspenseQuery(
    orpc.workspace.get.queryOptions({
      input: { workspaceId },
    }),
  );
};

export const useCreateWorkspace = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.workspace.create.mutationOptions({
      onSuccess: (data) => {
        toast.success(`Workspace ${data.workspace.name} criado com sucesso!`);

        queryClient.invalidateQueries(orpc.workspace.list.queryOptions());
      },
      onError: () => {
        toast.error("Erro ao criar workspace!");
      },
    }),
  );
};

export const useSuspenseColumnsByWorkspace = (workspaceId: string) => {
  return useSuspenseQuery(
    orpc.workspace.getColumnsByWorkspace.queryOptions({
      input: { workspaceId },
    }),
  );
};

export const useColumnsByWorkspace = (workspaceId: string) => {
  const { data, isLoading } = useQuery(
    orpc.workspace.getColumnsByWorkspace.queryOptions({
      input: { workspaceId },
      enabled: !!workspaceId,
    }),
  );

  return {
    columns: data?.columns ?? [],
    isLoading,
  };
};

export const useWorkspaceMembers = (workspaceId: string) => {
  const { data, isLoading } = useQuery(
    orpc.workspace.getMembers.queryOptions({
      input: { workspaceId },
      enabled: !!workspaceId,
    }),
  );

  return {
    members: data?.members ?? [],
    isLoading,
  };
};

export const useUpdateWorkspace = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.workspace.update.mutationOptions({
      onSuccess: () => {
        toast.success("Workspace atualizado com sucesso!");
        queryClient.invalidateQueries(orpc.workspace.list.queryOptions());
        queryClient.invalidateQueries({ queryKey: ["workspace.get"] });
      },
      onError: () => {
        toast.error("Erro ao atualizar workspace!");
      },
    }),
  );
};

export const useDeleteWorkspace = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.workspace.delete.mutationOptions({
      onSuccess: () => {
        toast.success("Workspace deletado com sucesso!");
        queryClient.invalidateQueries(orpc.workspace.list.queryOptions());
      },
      onError: (error: any) => {
        toast.error(error.message || "Erro ao deletar workspace!");
      },
    }),
  );
};

export const useCreateColumn = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.workspace.createColumn.mutationOptions({
      onSuccess: (data) => {
        toast.success("Coluna criada com sucesso!");
        queryClient.invalidateQueries(
          orpc.workspace.getColumnsByWorkspace.queryOptions({
            input: { workspaceId: data.column.workspaceId },
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
    orpc.workspace.updateColumn.mutationOptions({
      onSuccess: (data) => {
        queryClient.invalidateQueries(
          orpc.workspace.getColumnsByWorkspace.queryOptions({
            input: { workspaceId: data.column.workspaceId },
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
    orpc.workspace.deleteColumn.mutationOptions({
      onSuccess: (data) => {
        toast.success("Coluna deletada com sucesso!");
        queryClient.invalidateQueries(
          orpc.workspace.getColumnsByWorkspace.queryOptions({
            input: { workspaceId: data.column.workspaceId },
          }),
        );
      },
      onError: (error: any) => {
        toast.error(error.message || "Erro ao deletar coluna!");
      },
    }),
  );
};

export const useAddWorkspaceMember = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.workspace.addMember.mutationOptions({
      onSuccess: (data) => {
        toast.success("Membro adicionado com sucesso!");
        queryClient.invalidateQueries(
          orpc.workspace.getMembers.queryOptions({
            input: { workspaceId: data.member.workspaceId },
          }),
        );
      },
      onError: () => {
        toast.error("Erro ao adicionar membro!");
      },
    }),
  );
};

export const useRemoveWorkspaceMember = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.workspace.removeMember.mutationOptions({
      onSuccess: (data) => {
        toast.success("Membro removido com sucesso!");
        queryClient.invalidateQueries(
          orpc.workspace.getMembers.queryOptions({
            input: { workspaceId: data.member.workspaceId },
          }),
        );
      },
      onError: () => {
        toast.error("Erro ao remover membro!");
      },
    }),
  );
};

export const useListRecentMembers = (limit = 10) => {
  return useQuery(
    orpc.workspace.listRecentMembers.queryOptions({ input: { limit } }),
  );
};
