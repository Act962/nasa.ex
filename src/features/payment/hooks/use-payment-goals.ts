"use client";

/**
 * Hooks de metas de vendas e reserva de caixa (spec 0011).
 *
 * Padrão NASA: componentes consomem só estes hooks, nunca `orpc` direto.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

export function usePaymentGoalStatus(params: {
  year: number;
  month: number;
  enabled?: boolean;
}) {
  const { year, month, enabled = true } = params;
  return useQuery({
    ...orpc.payment.goals.status.queryOptions({ input: { year, month } }),
    enabled,
  });
}

export function useUpdatePaymentGoalConfig() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.payment.goals.updateConfig.mutationOptions(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orpc.payment.key() });
    },
  });
}

export function useUpsertPaymentGoalMonth() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.payment.goals.upsertMonth.mutationOptions(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orpc.payment.key() });
    },
  });
}
