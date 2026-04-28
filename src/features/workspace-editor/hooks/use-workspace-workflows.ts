import { orpc } from "@/lib/orpc";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { toast } from "sonner";

export const useSuspenseWorkspaceWorkflows = (workspaceId: string) =>
  useSuspenseQuery(
    orpc.workspaceWorkflow.list.queryOptions({ input: { workspaceId } }),
  );

export const useSuspenseWorkspaceWorkflow = (workflowId: string) =>
  useSuspenseQuery(
    orpc.workspaceWorkflow.getOne.queryOptions({ input: { workflowId } }),
  );

export const useCreateWorkspaceWorkflow = () => {
  const qc = useQueryClient();
  return useMutation(
    orpc.workspaceWorkflow.create.mutationOptions({
      onSuccess: (data) => {
        toast.success("Workflow criado com sucesso!");
        qc.invalidateQueries({
          queryKey: orpc.workspaceWorkflow.list.queryKey({
            input: { workspaceId: data.workspaceId! },
          }),
        });
      },
    }),
  );
};

export const useUpdateWorkspaceWorkflowName = () => {
  const qc = useQueryClient();
  return useMutation(
    orpc.workspaceWorkflow.update.updateName.mutationOptions({
      onSuccess: (data) => {
        toast.success("Workflow atualizado!");
        qc.invalidateQueries({
          queryKey: orpc.workspaceWorkflow.list.queryKey({
            input: { workspaceId: data.workspaceId! },
          }),
        });
        qc.invalidateQueries({
          queryKey: orpc.workspaceWorkflow.getOne.queryKey({
            input: { workflowId: data.id },
          }),
        });
      },
      onError: (err) =>
        toast.error(`Falha ao atualizar: ${err.message}`),
    }),
  );
};

export const useUpdateWorkspaceWorkflow = () => {
  const qc = useQueryClient();
  return useMutation(
    orpc.workspaceWorkflow.update.updateNodes.mutationOptions({
      onSuccess: (data) => {
        toast.success(`Workflow "${data.name}" salvo`);
        qc.invalidateQueries({
          queryKey: orpc.workspaceWorkflow.list.queryKey({
            input: { workspaceId: data.workspaceId! },
          }),
        });
        qc.invalidateQueries({
          queryKey: orpc.workspaceWorkflow.getOne.queryKey({
            input: { workflowId: data.id },
          }),
        });
      },
      onError: (err) => toast.error(`Falha ao salvar: ${err.message}`),
    }),
  );
};

export const useDeleteWorkspaceWorkflow = () => {
  const qc = useQueryClient();
  return useMutation(
    orpc.workspaceWorkflow.delete.mutationOptions({
      onSuccess: (data) => {
        toast.success(`Workflow "${data.name}" deletado`);
        qc.invalidateQueries({
          queryKey: orpc.workspaceWorkflow.list.queryKey({
            input: { workspaceId: data.workspaceId! },
          }),
        });
      },
      onError: (err) => toast.error(`Falha ao deletar: ${err.message}`),
    }),
  );
};

export const useExecuteWorkspaceWorkflow = () =>
  useMutation(
    orpc.workspaceWorkflow.execute.mutationOptions({
      onSuccess: (data) => toast.success(`Workflow "${data.name}" executado`),
      onError: (err) => toast.error(`Falha ao executar: ${err.message}`),
    }),
  );
