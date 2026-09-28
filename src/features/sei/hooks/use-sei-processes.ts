"use client";

import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useLeadSeiProcesses(leadId: string, enabled = true) {
  return useQuery({
    ...orpc.sei.listLeadProcesses.queryOptions({ input: { leadId } }),
    enabled: enabled && Boolean(leadId),
  });
}

export function useLinkSeiProcess(leadId: string) {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.sei.linkProcess.mutationOptions({
      onSuccess: () => {
        toast.success("Processo SEI vinculado ao lead.");
        queryClient.invalidateQueries({
          queryKey: orpc.sei.listLeadProcesses.key({ input: { leadId } }),
        });
      },
      onError: (error) => toast.error(error.message || "Não foi possível vincular o processo."),
    }),
  );
}

export function useRequestSeiSync(leadId: string) {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.sei.requestSync.mutationOptions({
      onSuccess: () => {
        toast.success("Sincronização com o SEI adicionada à fila.");
        window.setTimeout(() => {
          queryClient.invalidateQueries({
            queryKey: orpc.sei.listLeadProcesses.key({ input: { leadId } }),
          });
        }, 2500);
      },
      onError: (error) => toast.error(error.message || "Falha ao solicitar sincronização."),
    }),
  );
}

export function useUnlinkSeiProcess(leadId: string) {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.sei.unlinkProcess.mutationOptions({
      onSuccess: () => {
        toast.success("Vínculo com o processo removido.");
        queryClient.invalidateQueries({
          queryKey: orpc.sei.listLeadProcesses.key({ input: { leadId } }),
        });
      },
      onError: (error) => toast.error(error.message || "Falha ao remover o vínculo."),
    }),
  );
}
