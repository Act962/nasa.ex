"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { useInvalidateAccounting } from "./use-accounting-invalidation";

export function useAccountingChart() {
  return useQuery(orpc.accounting.chart.list.queryOptions({ input: {} }));
}

export function useCreateAccountingAccount() {
  const invalidateAccounting = useInvalidateAccounting();
  return useMutation({ ...orpc.accounting.chart.create.mutationOptions(), onSuccess: invalidateAccounting });
}

export function useUpdateAccountingAccount() {
  const invalidateAccounting = useInvalidateAccounting();
  return useMutation({ ...orpc.accounting.chart.update.mutationOptions(), onSuccess: invalidateAccounting });
}

export function useSetAccountingMapping() {
  const invalidateAccounting = useInvalidateAccounting();
  return useMutation({ ...orpc.accounting.chart.setMapping.mutationOptions(), onSuccess: invalidateAccounting });
}

export function useTrialBalance(params: { from: string; to: string }) {
  return useQuery(orpc.accounting.reports.trialBalance.queryOptions({ input: params }));
}

export function useLedger(params: { accountId: string | null; from: string; to: string }) {
  return useQuery({
    ...orpc.accounting.reports.ledger.queryOptions({
      input: { accountId: params.accountId ?? "", from: params.from, to: params.to },
    }),
    enabled: Boolean(params.accountId),
  });
}

export function useBalanceSheet(at: string) {
  return useQuery(orpc.accounting.reports.balanceSheet.queryOptions({ input: { at } }));
}

export function useReprocessJournal() {
  const invalidateAccounting = useInvalidateAccounting();
  return useMutation({ ...orpc.accounting.reports.reprocess.mutationOptions(), onSuccess: invalidateAccounting });
}
