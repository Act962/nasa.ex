"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

export function useFiscalInvoicesByContract(
  contractId: string,
  enabled = true,
) {
  return useQuery({
    ...orpc.fiscal.invoices.listByContract.queryOptions({
      input: { contractId },
    }),
    enabled: enabled && !!contractId,
  });
}

export function useFiscalInvoice(id: string, enabled = true) {
  return useQuery({
    ...orpc.fiscal.invoices.get.queryOptions({ input: { id } }),
    enabled: enabled && !!id,
  });
}

export function useIssueFiscalInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    ...orpc.fiscal.invoices.issueFromContract.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fiscal"] });
    },
  });
}

export function useRefreshFiscalInvoiceStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    ...orpc.fiscal.invoices.refreshStatus.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fiscal"] });
    },
  });
}

export function useCancelFiscalInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    ...orpc.fiscal.invoices.cancel.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fiscal"] });
    },
  });
}
