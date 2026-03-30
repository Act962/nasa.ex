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
  enabled = true,
}: {
  columnId: string;
  enabled?: boolean;
}) => {
  const query = orpc.action.listByColumn.infiniteOptions({
    input: (cursor: string | undefined) => ({
      columnId,
      cursor,
      limit: 6,
    }),
    queryKey: ["action.listByColumn", columnId],
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
}

export const useListActionByWorkspace = ({
  workspaceId,
  limit = 20,
  page = 1,
}: ListActionByWorkspace) => {
  const { data, isLoading } = useQuery(
    orpc.action.listByWorkspace.queryOptions({
      input: {
        workspaceId,
        limit,
        page,
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
