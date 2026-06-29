"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

export function useDunningRules() {
  return useQuery(orpc.payment.dunning.rules.list.queryOptions({ input: {} }));
}

export function useCreateDunningRule() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.payment.dunning.rules.create.mutationOptions(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payment", "dunning"] });
      qc.invalidateQueries({ queryKey: ["payment.dunning"] });
    },
  });
}

export function useUpdateDunningRule() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.payment.dunning.rules.update.mutationOptions(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payment"] }),
  });
}

export function useDeleteDunningRule() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.payment.dunning.rules.delete.mutationOptions(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payment"] }),
  });
}

export function useCreateDunningStep() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.payment.dunning.steps.create.mutationOptions(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payment"] }),
  });
}

export function useUpdateDunningStep() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.payment.dunning.steps.update.mutationOptions(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payment"] }),
  });
}

export function useDeleteDunningStep() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.payment.dunning.steps.delete.mutationOptions(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payment"] }),
  });
}

export function useAssignDunningRuleToEntry() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.payment.dunning.entries.assignRule.mutationOptions(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payment"] }),
  });
}

export function useDunningExecutionsByEntry(entryId: string | null) {
  return useQuery({
    ...orpc.payment.dunning.executions.listByEntry.queryOptions({
      input: { entryId: entryId ?? "" },
    }),
    enabled: !!entryId,
  });
}
