import { orpc } from "@/lib/orpc";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

interface UseSearchActionsParams {
  workspaceId: string;
  search?: string;
  columnIds?: string[];
  tagIds?: string[];
  participantIds?: string[];
  limit?: number;
  isArchived?: boolean;
  enabled?: boolean;
}

export const useSearchActions = ({
  workspaceId,
  search,
  columnIds = [],
  tagIds = [],
  participantIds = [],
  limit = 20,
  isArchived = false,
  enabled = true,
}: UseSearchActionsParams) => {
  const { data, isLoading, isFetching } = useQuery(
    orpc.action.searchActions.queryOptions({
      input: {
        workspaceId,
        ...(search && { search }),
        columnIds,
        tagIds,
        participantIds,
        limit,
        isArchived,
      },
      enabled: enabled && !!workspaceId,
      placeholderData: keepPreviousData,
    }),
  );

  return {
    actions: data?.actions ?? [],
    isLoading,
    isFetching,
  };
};
