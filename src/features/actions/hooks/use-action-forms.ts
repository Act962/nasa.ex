"use client";

import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

/** Pauta de formulários de uma tarefa + respostas preenchidas nela. */
export const useActionForms = (
  actionId: string,
  { enabled = true }: { enabled?: boolean } = {},
) => {
  const { data, isLoading, ...query } = useQuery({
    ...orpc.action.forms.list.queryOptions({ input: { actionId } }),
    enabled: enabled && !!actionId,
  });

  return {
    action: data?.action,
    forms: data?.forms ?? [],
    isLoading,
    ...query,
  };
};

function useActionFormsInvalidation() {
  const queryClient = useQueryClient();

  return (actionId: string, leadId?: string | null) => {
    queryClient.invalidateQueries(
      orpc.action.forms.list.queryOptions({ input: { actionId } }),
    );
    queryClient.invalidateQueries({ queryKey: ["action.listByColumn"] });
    if (leadId) {
      queryClient.invalidateQueries(
        orpc.leads.listFormResponses.queryOptions({ input: { leadId } }),
      );
    }
  };
}

/**
 * O `leadId` da tarefa vem por parâmetro porque o input da mutation não o
 * carrega — mesmo padrão do `useMutationCancelFormResponse`.
 */
export const useAttachFormToAction = (leadId?: string | null) => {
  const invalidate = useActionFormsInvalidation();

  return useMutation(
    orpc.action.forms.attach.mutationOptions({
      onSuccess: (_data, variables) => invalidate(variables.actionId, leadId),
    }),
  );
};

/**
 * Desvincular devolve as respostas ao lead como avulsas, então a lista do lead
 * precisa ser invalidada junto — senão o badge da tarefa fica lá até refresh.
 */
export const useDetachFormFromAction = (leadId?: string | null) => {
  const invalidate = useActionFormsInvalidation();

  return useMutation(
    orpc.action.forms.detach.mutationOptions({
      onSuccess: (_data, variables) => invalidate(variables.actionId, leadId),
    }),
  );
};
