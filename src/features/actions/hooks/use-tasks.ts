import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

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
      },
    }),
  );
};
