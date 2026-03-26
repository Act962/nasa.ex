import { orpc } from "@/lib/orpc";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { toast } from "sonner";

export const useSuspenseWokspaces = () => {
  return useSuspenseQuery(orpc.workspace.list.queryOptions());
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
