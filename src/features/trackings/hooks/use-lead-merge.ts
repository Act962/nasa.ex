import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// Detecta duplicatas no tracking de destino antes de mover (chamado imperativo).
export function useDetectMergeConflicts() {
  return useMutation(orpc.leads.detectMergeConflicts.mutationOptions({}));
}

export function useMergeLeads() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.leads.mergeLeads.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: ["leads.listLeadsByStatus"],
        });
        queryClient.invalidateQueries({ queryKey: orpc.status.getMany.key() });
      },
      onError: () => {
        toast.error("Erro ao mesclar leads");
      },
    }),
  );
}

// Move os leads sem conflito junto com a mesclagem (mesma coluna de destino).
export function useMoveCleanLeads() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.leads.updateManyStatus.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: ["leads.listLeadsByStatus"],
        });
        queryClient.invalidateQueries({ queryKey: orpc.status.getMany.key() });
      },
    }),
  );
}
