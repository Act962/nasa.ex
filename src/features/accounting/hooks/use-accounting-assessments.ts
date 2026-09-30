"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { useInvalidateAccounting } from "./use-accounting-invalidation";

export function useAccountingAssessments(year?: number) {
  return useQuery(orpc.accounting.assessments.list.queryOptions({ input: year ? { year } : {} }));
}

export function useRunAssessment() {
  const invalidateAccounting = useInvalidateAccounting();
  return useMutation({ ...orpc.accounting.assessments.run.mutationOptions(), onSuccess: invalidateAccounting });
}

export function useConfirmAssessment() {
  const invalidateAccounting = useInvalidateAccounting();
  return useMutation({ ...orpc.accounting.assessments.confirm.mutationOptions(), onSuccess: invalidateAccounting });
}

export function useReopenAssessment() {
  const invalidateAccounting = useInvalidateAccounting();
  return useMutation({ ...orpc.accounting.assessments.reopen.mutationOptions(), onSuccess: invalidateAccounting });
}
