import { orpc } from "@/lib/orpc";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { useActionStore } from "@/features/actions/context/use-action";

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

interface ColumnFilters {
  participantIds?: string[];
  tagIds?: string[];
  projectIds?: string[];
  dueDateFrom?: Date | null;
  dueDateTo?: Date | null;
}

export const useSuspenseColumnsByWorkspace = (workspaceId: string) => {
  return useSuspenseQuery(
    orpc.workspace.getColumnsByWorkspace.queryOptions({
      input: { workspaceId },
    }),
  );
};

export const useColumnsByWorkspace = (
  workspaceId: string,
  filters?: ColumnFilters,
) => {
  const { data, isLoading } = useQuery(
    orpc.workspace.getColumnsByWorkspace.queryOptions({
      input: {
        workspaceId,
        participantIds: filters?.participantIds ?? [],
        tagIds: filters?.tagIds ?? [],
        projectIds: filters?.projectIds ?? [],
        ...(filters?.dueDateFrom != null && { dueDateFrom: filters.dueDateFrom }),
        ...(filters?.dueDateTo != null && { dueDateTo: filters.dueDateTo }),
      },
      enabled: !!workspaceId,
      placeholderData: keepPreviousData,
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

export const useUpdateColumnOrder = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.column.updateNewOrder.mutationOptions({
      onSuccess: (data) => {
        queryClient.invalidateQueries(
          orpc.workspace.getColumnsByWorkspace.queryOptions({
            input: { workspaceId: data.workspaceId },
          }),
        );
      },
      onError: () => {
        toast.error("Erro ao reordenar coluna!");
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

// ─── Tags ─────────────────────────────────────────────────────────────────────

export const useListTags = (workspaceId: string) => {
  const { data, isLoading } = useQuery(
    orpc.workspace.listTags.queryOptions({
      input: { workspaceId },
      enabled: !!workspaceId,
    }),
  );
  return { tags: data?.tags ?? [], isLoading };
};

export const useCreateTag = () => {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.workspace.createTag.mutationOptions({
      onSuccess: (data) => {
        toast.success("Tag criada!");
        queryClient.invalidateQueries(
          orpc.workspace.listTags.queryOptions({
            input: { workspaceId: data.tag.workspaceId },
          }),
        );
      },
      onError: () => toast.error("Erro ao criar tag!"),
    }),
  );
};

export const useUpdateTag = () => {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.workspace.updateTag.mutationOptions({
      onSuccess: (data) => {
        queryClient.invalidateQueries(
          orpc.workspace.listTags.queryOptions({
            input: { workspaceId: data.tag.workspaceId },
          }),
        );
      },
      onError: () => toast.error("Erro ao atualizar tag!"),
    }),
  );
};

export const useDeleteTag = (workspaceId?: string) => {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.workspace.deleteTag.mutationOptions({
      onSuccess: () => {
        toast.success("Tag removida!");
        if (workspaceId) {
          queryClient.invalidateQueries(
            orpc.workspace.listTags.queryOptions({ input: { workspaceId } }),
          );
        } else {
          queryClient.invalidateQueries({ queryKey: ["workspace.listTags"] });
        }
      },
      onError: () => toast.error("Erro ao remover tag!"),
    }),
  );
};

export const useAddTagToAction = () => {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.workspace.addTagToAction.mutationOptions({
      onSuccess: (_, variables) => {
        queryClient.invalidateQueries(
          orpc.action.get.queryOptions({
            input: { actionId: variables.actionId },
          }),
        );
        queryClient.invalidateQueries({ queryKey: ["action.listByColumn"] });
      },
      onError: () => toast.error("Erro ao adicionar tag!"),
    }),
  );
};

export const useRemoveTagFromAction = () => {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.workspace.removeTagFromAction.mutationOptions({
      onSuccess: (_, variables) => {
        queryClient.invalidateQueries(
          orpc.action.get.queryOptions({
            input: { actionId: variables.actionId },
          }),
        );
        queryClient.invalidateQueries({ queryKey: ["action.listByColumn"] });
      },
      onError: () => toast.error("Erro ao remover tag!"),
    }),
  );
};

// ─── Folders ──────────────────────────────────────────────────────────────────

export const useListFolders = () => {
  return useQuery(orpc.workspace.listFolders.queryOptions({ input: {} }));
};

export const useCreateFolder = () => {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.workspace.createFolder.mutationOptions({
      onSuccess: () => {
        toast.success("Pasta criada!");
        queryClient.invalidateQueries(
          orpc.workspace.listFolders.queryOptions({ input: {} }),
        );
      },
      onError: () => toast.error("Erro ao criar pasta!"),
    }),
  );
};

export const useDeleteFolder = () => {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.workspace.deleteFolder.mutationOptions({
      onSuccess: () => {
        toast.success("Pasta removida!");
        queryClient.invalidateQueries(
          orpc.workspace.listFolders.queryOptions({ input: {} }),
        );
      },
      onError: () => toast.error("Erro ao remover pasta!"),
    }),
  );
};

// ─── Action Extra Fields ───────────────────────────────────────────────────────

export const useUpdateActionFields = () => {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.workspace.updateActionFields.mutationOptions({
      onSuccess: (data) => {
        queryClient.invalidateQueries(
          orpc.action.get.queryOptions({ input: { actionId: data.action.id } }),
        );
        queryClient.invalidateQueries({ queryKey: ["action.listByColumn"] });
        queryClient.invalidateQueries({
          queryKey: ["action.listByWorkspace"],
        });
      },
      onError: () => toast.error("Erro ao atualizar ação!"),
    }),
  );
};

export const useCopyAction = () => {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.workspace.copyAction.mutationOptions({
      onSuccess: () => {
        toast.success("Ação copiada!");
        queryClient.invalidateQueries({ queryKey: ["action.listByColumn"] });
      },
      onError: () => toast.error("Erro ao copiar ação!"),
    }),
  );
};

export const useMoveAction = () => {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.workspace.moveAction.mutationOptions({
      onSuccess: (data) => {
        toast.success("Ação movida!");
        queryClient.invalidateQueries({ queryKey: ["action.listByColumn"] });
        queryClient.invalidateQueries(orpc.workspace.list.queryOptions());
        queryClient.invalidateQueries(
          orpc.action.get.queryOptions({ input: { actionId: data.action.id } }),
        );
      },
      onError: () => toast.error("Erro ao mover ação!"),
    }),
  );
};

export const useMoveActions = () => {
  const queryClient = useQueryClient();
  const { clearSelection } = useActionStore();

  return useMutation(
    orpc.workspace.moveActions.mutationOptions({
      onSuccess: () => {
        toast.success("Ações movidas!");
        queryClient.invalidateQueries({ queryKey: ["action.listByColumn"] });
        queryClient.invalidateQueries(orpc.workspace.list.queryOptions());
        clearSelection();
      },
      onError: () => toast.error("Erro ao mover ações!"),
    }),
  );
};

export const useDeleteActions = () => {
  const queryClient = useQueryClient();
  const { clearSelection } = useActionStore();

  return useMutation(
    orpc.workspace.deleteActions.mutationOptions({
      onSuccess: () => {
        toast.success("Ações deletadas!");
        queryClient.invalidateQueries({ queryKey: ["action.listByColumn"] });
        queryClient.invalidateQueries(orpc.workspace.list.queryOptions());
        clearSelection();
      },
      onError: () => toast.error("Erro ao deletar ações!"),
    }),
  );
};

export const useArchiveActions = () => {
  const queryClient = useQueryClient();
  const { clearSelection } = useActionStore();

  return useMutation(
    orpc.workspace.archiveActions.mutationOptions({
      onSuccess: () => {
        toast.success("Ações arquivadas!");
        queryClient.invalidateQueries({ queryKey: ["action.listByColumn"] });
        queryClient.invalidateQueries(orpc.workspace.list.queryOptions());
        clearSelection();
      },
      onError: () => toast.error("Erro ao arquivar ações!"),
    }),
  );
};

// ─── Cross-Company Sharing ────────────────────────────────────────────────────

export const useGetCompanyCode = () => {
  return useQuery(orpc.workspace.getCompanyCode.queryOptions({ input: {} }));
};

export const useShareAction = () => {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.workspace.shareAction.mutationOptions({
      onSuccess: (data) => {
        toast.success(
          `Card enviado para ${data.targetOrgName}! Aguardando aprovação.`,
        );
        queryClient.invalidateQueries(
          orpc.workspace.listOutgoingShares.queryOptions({ input: {} }),
        );
      },
      onError: (error: any) =>
        toast.error(error.message || "Erro ao compartilhar card!"),
    }),
  );
};

export const useListIncomingShares = (status?: string) => {
  const { data, isLoading } = useQuery(
    orpc.workspace.listIncomingShares.queryOptions({
      input: { status },
    }),
  );
  return { shares: data?.shares ?? [], isLoading };
};

export const useListOutgoingShares = (status?: string) => {
  const { data, isLoading } = useQuery(
    orpc.workspace.listOutgoingShares.queryOptions({
      input: { status },
    }),
  );
  return { shares: data?.shares ?? [], isLoading };
};

// Lista orgs onde o user é membro (excluindo a corrente). Usado pelo
// multi-select "Compartilhar com empresas" no CreateActionModal.
export const useShareableOrgs = () => {
  return useQuery(
    orpc.workspace.listShareableOrgs.queryOptions({ input: {} }),
  );
};

// Compartilha uma action existente com 1+ orgs (cópia direta ou PENDING
// dependendo do role do user em cada org). Usado no ActionShareTargetsField
// dentro do ViewActionModal.
export const useShareActionWithOrgs = () => {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.action.shareWithOrgs.mutationOptions({
      onSuccess: (data) => {
        const direct = data.results.filter((r) => r.kind === "direct").length;
        const pending = data.results.filter((r) => r.kind === "pending").length;
        const skipped = data.results.filter((r) => r.kind === "skipped").length;
        const parts: string[] = [];
        if (direct) parts.push(`${direct} cópia(s) direta`);
        if (pending) parts.push(`${pending} aguardando aprovação`);
        if (parts.length === 0 && skipped) {
          toast.info("Empresas selecionadas já tinham compartilhamento ativo.");
        } else if (parts.length > 0) {
          toast.success(`Compartilhado: ${parts.join(", ")}.`);
        }
        queryClient.invalidateQueries(
          orpc.workspace.listOutgoingShares.queryOptions({ input: {} }),
        );
      },
      onError: (error: any) =>
        toast.error(error.message || "Erro ao compartilhar"),
    }),
  );
};

export const useApproveShare = () => {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.workspace.approveShare.mutationOptions({
      onSuccess: () => {
        toast.success(
          "Compartilhamento aprovado! Card copiado para o workspace.",
        );
        queryClient.invalidateQueries(
          orpc.workspace.listIncomingShares.queryOptions({ input: {} }),
        );
        queryClient.invalidateQueries({ queryKey: ["action.listByColumn"] });
      },
      onError: (error: any) => toast.error(error.message || "Erro ao aprovar!"),
    }),
  );
};

export const useRejectShare = () => {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.workspace.rejectShare.mutationOptions({
      onSuccess: () => {
        toast.success("Compartilhamento rejeitado.");
        queryClient.invalidateQueries(
          orpc.workspace.listIncomingShares.queryOptions({ input: {} }),
        );
      },
      onError: (error: any) =>
        toast.error(error.message || "Erro ao rejeitar!"),
    }),
  );
};

export const useRemoveFileAction = () => {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.workspace.removeFileAction.mutationOptions({
      onSuccess: (data) => {
        toast.success("Arquivo removido com sucesso!");
        queryClient.invalidateQueries(
          orpc.workspace.getColumnsByWorkspace.queryOptions({
            input: { workspaceId: data.action.workspaceId },
          }),
        );
        queryClient.invalidateQueries(
          orpc.action.get.queryOptions({ input: { actionId: data.action.id } }),
        );
        queryClient.invalidateQueries({ queryKey: ["action.listByColumn"] });
      },
      onError: (error: any) =>
        toast.error(error.message || "Erro ao remover arquivo!"),
    }),
  );
};
