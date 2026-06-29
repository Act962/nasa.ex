"use client";

import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

/**
 * Hook de mutation pra cancelar (deletar) uma `FormResponses`.
 *
 * Invalida as queries afetadas pela exclusão da resposta:
 *  - `leads.listFormResponses` → aba Formulários do detalhe do lead
 *    (form group volta pra "Preencher").
 *  - `leads.listLeadsByStatus` → kanban (ícone do form some do card).
 *  - `form.listRecentResponses` → painel global de respostas recentes.
 *  - `form.get` → detalhe do form (caso aberto).
 *
 * Toasts/erros ficam no componente que consome o hook.
 */
export function useMutationCancelFormResponse(leadId?: string) {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.form.cancelResponse.mutationOptions({
      onSuccess: () => {
        // Aba Formulários do detalhe do lead.
        if (leadId) {
          queryClient.invalidateQueries({
            queryKey: orpc.leads.listFormResponses.queryKey({
              input: { leadId },
            }),
          });
        }
        // Kanban (o ícone do form some do card do lead).
        queryClient.invalidateQueries({
          queryKey: ["leads.listLeadsByStatus"],
        });
        // Painel global de respostas recentes — match parcial via prefix.
        queryClient.invalidateQueries({
          queryKey: ["form.listRecentResponses"],
        });
      },
    }),
  );
}
