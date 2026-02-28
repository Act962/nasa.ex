import { orpc } from "@/lib/orpc";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { toast } from "sonner";

export const useSuspenseWorkflows = (trackingId: string) => {
  return useSuspenseQuery(
    orpc.workflow.list.queryOptions({
      input: {
        trackingId,
      },
    }),
  );
};

export const useSuspenseWorkflow = (workflowId: string) => {
  return useSuspenseQuery(
    orpc.workflow.getOne.queryOptions({
      input: {
        workflowId,
      },
    }),
  );
};

export const useCreateWorkflow = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.workflow.create.mutationOptions({
      onSuccess: (data) => {
        toast.success("Workflow criado com sucesso!");
        queryClient.invalidateQueries({
          queryKey: orpc.workflow.list.queryKey({
            input: {
              trackingId: data.trackingId,
            },
          }),
        });
      },
    }),
  );
};

export const useUpdateWorkflowName = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.workflow.update.updateName.mutationOptions({
      onSuccess: (data) => {
        toast.success("Workflow atualizado com sucesso!");
        queryClient.invalidateQueries({
          queryKey: orpc.workflow.list.queryKey({
            input: {
              trackingId: data.trackingId,
            },
          }),
        });

        queryClient.invalidateQueries({
          queryKey: orpc.workflow.getOne.queryKey({
            input: {
              workflowId: data.id,
            },
          }),
        });
      },
      onError: (error) => {
        toast.error(`Falha ao atualizar o nome do workflow: ${error.message}`);
      },
    }),
  );
};

export const useUpdateWorkflow = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.workflow.update.updateNodes.mutationOptions({
      onSuccess: (data) => {
        toast.success(`Workflow "${data.name}" salvo`);
        queryClient.invalidateQueries({
          queryKey: orpc.workflow.list.queryKey({
            input: {
              trackingId: data.trackingId,
            },
          }),
        });

        queryClient.invalidateQueries({
          queryKey: orpc.workflow.getOne.queryKey({
            input: {
              workflowId: data.id,
            },
          }),
        });
      },
      onError: (error) => {
        toast.error(`Falha ao atualizar o nome do workflow: ${error.message}`);
      },
    }),
  );
};

export const useDeleteWorkflow = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.workflow.delete.mutationOptions({
      onSuccess: (data) => {
        toast.success(`Workflow "${data.name}" deletado`);
        queryClient.invalidateQueries({
          queryKey: orpc.workflow.list.queryKey({
            input: {
              trackingId: data.trackingId,
            },
          }),
        });
      },
      onError: (error) => {
        toast.error(`Falha ao deletar o workflow: ${error.message}`);
      },
    }),
  );
};

export const useExecuteWorkflow = () => {
  // const queryClient = useQueryClient();

  return useMutation(
    orpc.workflow.execute.mutationOptions({
      onSuccess: (data) => {
        toast.success(`Workflow "${data.name}" executado`);
      },
      onError: (error) => {
        toast.error(`Falha ao executar o workflow: ${error.message}`);
      },
    }),
  );
};
