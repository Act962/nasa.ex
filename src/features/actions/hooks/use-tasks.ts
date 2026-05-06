import { orpc } from "@/lib/orpc";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useMemo } from "react";
import { useActionKanbanStore, EMPTY_ACTIONS } from "../lib/kanban-store";

export const useCreateTask = () => {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.action.create.mutationOptions({
      onSuccess: (data) => {
        queryClient.invalidateQueries(
          orpc.workspace.getColumnsByWorkspace.queryOptions({
            input: {
              workspaceId: data.action.workspaceId,
            },
          }),
        );

        queryClient.invalidateQueries({
          queryKey: ["action.listByColumn", data.action.columnId],
        });

        queryClient.invalidateQueries(
          orpc.action.listByWorkspace.queryOptions({
            input: {
              workspaceId: data.action.workspaceId,
            },
          }),
        );
      },
    }),
  );
};

export const useListActionByColumn = (columnId: string) => {
  const { data, isLoading } = useQuery(
    orpc.action.listByColumn.queryOptions({
      input: {
        columnId,
      },
    }),
  );

  return {
    actions: data?.action ?? [],
    isLoading,
  };
};

export const useInfiniteActionsByStatus = ({
  columnId,
  filters,
  enabled = true,
}: {
  columnId: string;
  filters?: {
    participantIds?: string[];
    tagIds?: string[];
    projectIds?: string[];
    dueDateFrom?: Date | null;
    dueDateTo?: Date | null;
    sortBy?: "order" | "createdAt" | "dueDate" | "priority" | "title";
    sortOrder?: "asc" | "desc";
    isArchived?: boolean;
  };
  enabled?: boolean;
}) => {
  const query = orpc.action.listByColumn.infiniteOptions({
    input: (cursor: string | undefined) => ({
      columnId,
      cursor,
      limit: 6,
      participantIds: filters?.participantIds ?? [],
      tagIds: filters?.tagIds ?? [],
      projectIds: filters?.projectIds ?? [],
      ...(filters?.dueDateFrom != null && { dueDateFrom: filters.dueDateFrom }),
      ...(filters?.dueDateTo != null && { dueDateTo: filters.dueDateTo }),
      ...(filters?.sortBy != null && { sortBy: filters.sortBy }),
      sortOrder: filters?.sortOrder ?? "desc",
      isArchived: filters?.isArchived ?? false,
    }),
    queryKey: [
      "action.listByColumn",
      columnId,
      filters?.participantIds?.join(",") ?? "",
      filters?.tagIds?.join(",") ?? "",
      filters?.projectIds?.join(",") ?? "",
      filters?.dueDateFrom?.toISOString() ?? "",
      filters?.dueDateTo?.toISOString() ?? "",
      filters?.sortBy ?? "",
      filters?.sortOrder ?? "",
      String(filters?.isArchived ?? false),
    ],
    enabled,
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteQuery(query);

  const actions = useMemo(
    () => data?.pages.flatMap((page) => page.action) ?? EMPTY_ACTIONS,
    [data],
  );

  return {
    data: actions,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  };
};

interface ListActionByWorkspace {
  workspaceId: string;
  limit?: number;
  page?: number;
  participantIds?: string[];
  tagIds?: string[];
  projectIds?: string[];
  dueDateFrom?: Date | null;
  dueDateTo?: Date | null;
  sortBy?: "order" | "createdAt" | "dueDate" | "priority" | "title";
  sortOrder?: "asc" | "desc";
  isArchived?: boolean;
  title?: string;
}

export const useListActionByWorkspace = ({
  workspaceId,
  limit = 20,
  page = 1,
  participantIds = [],
  tagIds = [],
  projectIds = [],
  dueDateFrom = null,
  dueDateTo = null,
  sortBy = "createdAt",
  sortOrder = "desc",
  isArchived = false,
  title = "",
}: ListActionByWorkspace) => {
  const { data, isLoading } = useQuery(
    orpc.action.listByWorkspace.queryOptions({
      input: {
        workspaceId,
        limit,
        page,
        participantIds,
        tagIds,
        projectIds,
        ...(dueDateFrom != null && { dueDateFrom }),
        ...(dueDateTo != null && { dueDateTo }),
        sortBy,
        sortOrder,
        isArchived,
        title,
      },
    }),
  );

  return {
    actions: data?.actions ?? [],
    total: data?.total ?? 0,
    isLoading,
  };
};

export const useReorderAction = () => {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.action.reorder.mutationOptions({
      onSuccess: (data) => {
        queryClient.invalidateQueries(
          orpc.workspace.getColumnsByWorkspace.queryOptions({
            input: {
              workspaceId: data.action.workspaceId,
            },
          }),
        );
        queryClient.invalidateQueries({
          queryKey: ["action.listByColumn"],
        });
        queryClient.invalidateQueries(
          orpc.action.listByWorkspace.queryOptions({
            input: {
              workspaceId: data.action.workspaceId,
            },
          }),
        );
      },
      onError: (error) => {
        console.error("Failed to reorder action:", error);
      },
    }),
  );
};

export const useQueryAction = (actionId: string) => {
  const { data, isLoading } = useQuery(
    orpc.action.get.queryOptions({
      input: {
        actionId,
      },
    }),
  );

  return {
    action: data?.action,
    hasAccess: data?.hasAccess,
    isLoading,
  };
};

export const useUpdateAction = () => {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.action.update.mutationOptions({
      onSuccess: (data) => {
        queryClient.invalidateQueries(
          orpc.action.get.queryOptions({
            input: { actionId: data.action.id },
          }),
        );
        queryClient.invalidateQueries({
          queryKey: ["action.listByColumn"],
        });
        queryClient.invalidateQueries(
          orpc.action.listByWorkspace.queryOptions({
            input: { workspaceId: data.action.workspaceId },
          }),
        );
        queryClient.invalidateQueries(
          orpc.workspace.getColumnsByWorkspace.queryOptions({
            input: { workspaceId: data.action.workspaceId },
          }),
        );
        // Calendário consolidado (Workspace Calendar) — refrescar pra
        // refletir mudanças de data via drag-and-drop.
        queryClient.invalidateQueries({
          queryKey: ["action.getWorkspaceCalendar"],
        });
      },
    }),
  );
};

export const useDeleteAction = () => {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.action.delete.mutationOptions({
      onSuccess: (data) => {
        queryClient.invalidateQueries({
          queryKey: ["action.listByColumn"],
        });
        queryClient.invalidateQueries(
          orpc.action.listByWorkspace.queryOptions({
            input: { workspaceId: data.action.workspaceId },
          }),
        );
        queryClient.invalidateQueries(
          orpc.workspace.getColumnsByWorkspace.queryOptions({
            input: { workspaceId: data.action.workspaceId },
          }),
        );
      },
    }),
  );
};

export const useCreateSubAction = (actionId: string) => {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.action.createSubAction.mutationOptions({
      onSuccess: (data) => {
        queryClient.invalidateQueries(
          orpc.action.get.queryOptions({ input: { actionId } }),
        );
        queryClient.invalidateQueries({
          queryKey: ["action.listByColumn"],
        });
        queryClient.invalidateQueries(
          orpc.action.listByWorkspace.queryOptions({
            input: { workspaceId: data.subAction.action.workspaceId },
          }),
        );
      },
    }),
  );
};

export const useUpdateSubAction = (actionId: string) => {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.action.updateSubAction.mutationOptions({
      onSuccess: (data) => {
        queryClient.invalidateQueries(
          orpc.action.get.queryOptions({ input: { actionId } }),
        );
        queryClient.invalidateQueries({
          queryKey: ["action.listByColumn"],
        });
        queryClient.invalidateQueries(
          orpc.action.listByWorkspace.queryOptions({
            input: { workspaceId: data.subAction.action.workspaceId },
          }),
        );
      },
    }),
  );
};

export const useDeleteSubAction = (actionId: string) => {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.action.deleteSubAction.mutationOptions({
      onSuccess: (data) => {
        queryClient.invalidateQueries(
          orpc.action.get.queryOptions({ input: { actionId } }),
        );
        queryClient.invalidateQueries({
          queryKey: ["action.listByColumn"],
        });
        queryClient.invalidateQueries(
          orpc.action.listByWorkspace.queryOptions({
            input: { workspaceId: data.subAction.action.workspaceId },
          }),
        );
      },
    }),
  );
};

export const useAddParticipant = (actionId: string) => {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.action.addParticipant.mutationOptions({
      onSuccess: (data) => {
        queryClient.invalidateQueries(
          orpc.action.get.queryOptions({ input: { actionId } }),
        );
        queryClient.invalidateQueries({
          queryKey: ["action.listByColumn"],
        });
        queryClient.invalidateQueries(
          orpc.action.listByWorkspace.queryOptions({
            input: { workspaceId: data.participant.action.workspaceId },
          }),
        );
      },
    }),
  );
};

export const useRemoveParticipant = (actionId: string) => {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.action.removeParticipant.mutationOptions({
      onSuccess: (data) => {
        queryClient.invalidateQueries(
          orpc.action.get.queryOptions({ input: { actionId } }),
        );
        queryClient.invalidateQueries({
          queryKey: ["action.listByColumn"],
        });
        queryClient.invalidateQueries(
          orpc.action.listByWorkspace.queryOptions({
            input: { workspaceId: data.participant.action.workspaceId },
          }),
        );
      },
    }),
  );
};

export const useAddResponsible = (actionId: string) => {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.action.addResponsible.mutationOptions({
      onSuccess: (data) => {
        queryClient.invalidateQueries(
          orpc.action.get.queryOptions({ input: { actionId } }),
        );
        queryClient.invalidateQueries({
          queryKey: ["action.listByColumn"],
        });
        queryClient.invalidateQueries(
          orpc.action.listByWorkspace.queryOptions({
            input: { workspaceId: data.responsible.action.workspaceId },
          }),
        );
      },
    }),
  );
};

export const useRemoveResponsible = (actionId: string) => {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.action.removeResponsible.mutationOptions({
      onSuccess: (data) => {
        queryClient.invalidateQueries(
          orpc.action.get.queryOptions({ input: { actionId } }),
        );
        queryClient.invalidateQueries({
          queryKey: ["action.listByColumn"],
        });
        queryClient.invalidateQueries(
          orpc.action.listByWorkspace.queryOptions({
            input: { workspaceId: data.responsible.action.workspaceId },
          }),
        );
      },
    }),
  );
};

export const useQueryActionsAnalytics = () => {
  return useQuery(orpc.action.getAnalytics.queryOptions());
};

export const useListRecentActions = (limit = 10) => {
  return useQuery(orpc.action.listRecent.queryOptions({ input: { limit } }));
};

export const useFavoritedActions = (workspaceId: string) => {
  const { data, isLoading } = useQuery(
    orpc.action.listFavorites.queryOptions({
      input: { workspaceId, limit: 100 },
      enabled: !!workspaceId,
    }),
  );

  return {
    actions: data?.items ?? [],
    total: data?.total ?? 0,
    isLoading,
  };
};

export const useWorkspaceCalendar = ({
  startDate,
  endDate,
}: {
  startDate: string;
  endDate: string;
}) => {
  const { data, isLoading } = useQuery(
    orpc.action.getWorkspaceCalendar.queryOptions({
      input: { startDate, endDate },
    }),
  );

  return {
    actions: data?.actions ?? [],
    isLoading,
  };
};

export const useAddSubActionResponsible = (actionId: string) => {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.action.addSubActionResponsible.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(
          orpc.action.get.queryOptions({ input: { actionId } }),
        );
      },
    }),
  );
};

export const useRemoveSubActionResponsible = (actionId: string) => {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.action.removeSubActionResponsible.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(
          orpc.action.get.queryOptions({ input: { actionId } }),
        );
      },
    }),
  );
};

export const usePromoteSubAction = (actionId: string) => {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.action.promoteSubAction.mutationOptions({
      onSuccess: (data) => {
        queryClient.invalidateQueries(
          orpc.action.get.queryOptions({ input: { actionId } }),
        );
        queryClient.invalidateQueries({
          queryKey: ["action.listByColumn"],
        });
        queryClient.invalidateQueries(
          orpc.action.listByWorkspace.queryOptions({
            input: { workspaceId: data.action.workspaceId },
          }),
        );
      },
    }),
  );
};

export const useReorderSubActions = (actionId: string) => {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.action.reorderSubActions.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(
          orpc.action.get.queryOptions({ input: { actionId } }),
        );
      },
    }),
  );
};

export const useCreateSubActionGroup = (actionId: string) => {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.action.createSubActionGroup.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(
          orpc.action.get.queryOptions({ input: { actionId } }),
        );
      },
    }),
  );
};

export const useUpdateSubActionGroup = (actionId: string) => {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.action.updateSubActionGroup.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(
          orpc.action.get.queryOptions({ input: { actionId } }),
        );
      },
    }),
  );
};

export const useDeleteSubActionGroup = (actionId: string) => {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.action.deleteSubActionGroup.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(
          orpc.action.get.queryOptions({ input: { actionId } }),
        );
      },
    }),
  );
};

export const useReorderSubActionGroups = (actionId: string) => {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.action.reorderSubActionGroups.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(
          orpc.action.get.queryOptions({ input: { actionId } }),
        );
      },
    }),
  );
};
