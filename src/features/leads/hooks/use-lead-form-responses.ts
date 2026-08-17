"use client";

import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

/**
 * Respostas de formulário de um lead, com a tarefa de origem de cada uma.
 * Substitui as chamadas `orpc` inline que existiam nos componentes (regra 9
 * do CLAUDE.md).
 */
export const useLeadFormResponses = (
  leadId: string,
  { enabled = true }: { enabled?: boolean } = {},
) => {
  const { data, isLoading, ...query } = useQuery({
    ...orpc.leads.listFormResponses.queryOptions({ input: { leadId } }),
    enabled: enabled && !!leadId,
  });

  return {
    responses: data?.responses ?? [],
    isLoading,
    ...query,
  };
};

export const useLeadResponsesOfForm = (
  { leadId, formId }: { leadId: string; formId: string },
  { enabled = true }: { enabled?: boolean } = {},
) => {
  const { data, isLoading, ...query } = useQuery({
    ...orpc.leads.listResponsesOfForm.queryOptions({
      input: { leadId, formId },
    }),
    enabled: enabled && !!leadId && !!formId,
  });

  return {
    form: data?.form,
    lead: data?.lead,
    responses: data?.responses ?? [],
    isLoading,
    ...query,
  };
};
