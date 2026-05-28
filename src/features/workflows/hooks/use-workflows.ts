import { orpc } from "@/lib/orpc";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { useSpacePointCtx } from "@/features/space-point/components/space-point-provider";

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
  const { earn } = useSpacePointCtx();

  return useMutation(
    orpc.workflow.create.mutationOptions({
      onSuccess: (data) => {
        toast.success("Workflow criado com sucesso!");
        earn("automation_created", "Novo workflow criado ✨");
        queryClient.invalidateQueries({
          queryKey: orpc.workflow.list.queryKey({
            input: {
              trackingId: data.trackingId!,
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
              trackingId: data.trackingId!,
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
              trackingId: data.trackingId!,
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

        // TagsV2: nodes podem ter mudado referências de tag (TAG action /
        // LEAD_TAGGED trigger) — invalida tag.list pra recalcular o
        // automationCount mostrado nas badges + lista do TagSheet.
        // Predicate: pega TODAS as variações de input (com/sem trackingId,
        // includeArchived, etc).
        queryClient.invalidateQueries({
          predicate: (q) => {
            const key = q.queryKey;
            return (
              Array.isArray(key) &&
              key[0] === "tags" &&
              (key[1] === "listTags" || key[1] === "getDuplicateTags" ||
                key[1] === "getReferencedWorkflows")
            );
          },
        });
      },
      onError: (error) => {
        toast.error(`Falha ao atualizar o nome do workflow: ${error.message}`);
      },
    }),
  );
};

export const useUpdateWorkflowIsActive = (trackingId: string) => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.workflow.update.updateIsActive.mutationOptions({
      onSuccess: (data) => {
        queryClient.invalidateQueries({
          queryKey: orpc.workflow.list.queryKey({
            input: { trackingId },
          }),
        });
        queryClient.invalidateQueries({
          queryKey: orpc.workflow.getOne.queryKey({
            input: { workflowId: data.id },
          }),
        });
        // TagsV2: automationCount conta SÓ workflows ativos. Toggle de
        // is_active muda a conta — invalida pra refletir.
        queryClient.invalidateQueries({
          predicate: (q) => {
            const key = q.queryKey;
            return (
              Array.isArray(key) &&
              key[0] === "tags" &&
              (key[1] === "listTags" || key[1] === "getDuplicateTags" ||
                key[1] === "getReferencedWorkflows")
            );
          },
        });
      },
      onError: (error) => {
        toast.error(`Falha ao alterar status do workflow: ${error.message}`);
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
              trackingId: data.trackingId!,
            },
          }),
        });
        // TagsV2: delete remove referências de tag — recalcula automationCount.
        queryClient.invalidateQueries({
          predicate: (q) => {
            const key = q.queryKey;
            return (
              Array.isArray(key) &&
              key[0] === "tags" &&
              (key[1] === "listTags" || key[1] === "getDuplicateTags" ||
                key[1] === "getReferencedWorkflows")
            );
          },
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
  const { earn } = useSpacePointCtx();

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
