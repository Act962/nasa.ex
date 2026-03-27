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
