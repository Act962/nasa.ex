import { orpc } from "@/lib/orpc";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";

/**
 * Hooks pro CRUD de pastas de workflows. Padrão: cada mutation invalida
 * tanto `workflowFolder.list` (pra atualizar count + nomes) quanto
 * `workflow.list` (pra workflows aparecerem na pasta certa).
 *
 * `moveWorkflow` é mutation separada porque move 1 workflow por vez —
 * UI usa dropdown na linha de cada workflow.
 */

export const useWorkflowFolders = (trackingId: string) => {
  return useQuery(
    orpc.workflowFolder.list.queryOptions({
      input: { trackingId },
    }),
  );
};

export const useCreateWorkflowFolder = (trackingId: string) => {
  const qc = useQueryClient();
  return useMutation(
    orpc.workflowFolder.create.mutationOptions({
      onSuccess: () => {
        toast.success("Pasta criada");
        qc.invalidateQueries({
          queryKey: orpc.workflowFolder.list.queryKey({
            input: { trackingId },
          }),
        });
      },
      onError: (error) => {
        toast.error(`Erro ao criar pasta: ${error.message}`);
      },
    }),
  );
};

export const useUpdateWorkflowFolder = (trackingId: string) => {
  const qc = useQueryClient();
  return useMutation(
    orpc.workflowFolder.update.mutationOptions({
      onSuccess: () => {
        toast.success("Pasta renomeada");
        qc.invalidateQueries({
          queryKey: orpc.workflowFolder.list.queryKey({
            input: { trackingId },
          }),
        });
      },
      onError: (error) => {
        toast.error(`Erro ao renomear: ${error.message}`);
      },
    }),
  );
};

export const useDeleteWorkflowFolder = (trackingId: string) => {
  const qc = useQueryClient();
  return useMutation(
    orpc.workflowFolder.delete.mutationOptions({
      onSuccess: (data) => {
        toast.success(`Pasta "${data.name}" excluída`);
        qc.invalidateQueries({
          queryKey: orpc.workflowFolder.list.queryKey({
            input: { trackingId },
          }),
        });
      },
      onError: (error) => {
        // Erro mais comum: pasta com workflows dentro (handler bloqueia
        // com BAD_REQUEST + mensagem amigável).
        toast.error(error.message);
      },
    }),
  );
};

export const useMoveWorkflowToFolder = (trackingId: string) => {
  const qc = useQueryClient();
  return useMutation(
    orpc.workflowFolder.moveWorkflow.mutationOptions({
      onSuccess: () => {
        toast.success("Automação movida");
        qc.invalidateQueries({
          queryKey: orpc.workflow.list.queryKey({
            input: { trackingId },
          }),
        });
        qc.invalidateQueries({
          queryKey: orpc.workflowFolder.list.queryKey({
            input: { trackingId },
          }),
        });
      },
      onError: (error) => {
        toast.error(`Erro ao mover: ${error.message}`);
      },
    }),
  );
};
