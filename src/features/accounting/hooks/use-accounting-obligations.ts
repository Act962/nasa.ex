"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { useInvalidateAccounting } from "./use-accounting-invalidation";

export function useAccountingObligations(params: { from?: string; to?: string; refresh?: boolean } = {}) {
  return useQuery(orpc.accounting.obligations.list.queryOptions({ input: params }));
}

export function useSetObligationStatus() {
  const invalidateAccounting = useInvalidateAccounting();
  return useMutation({ ...orpc.accounting.obligations.setStatus.mutationOptions(), onSuccess: invalidateAccounting });
}
