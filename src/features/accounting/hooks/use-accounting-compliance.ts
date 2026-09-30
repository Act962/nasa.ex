"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { useInvalidateAccounting } from "./use-accounting-invalidation";

export function useRegularityScore() {
  return useQuery(orpc.accounting.compliance.score.queryOptions({ input: {} }));
}

export function useRegularityHistory(days = 90) {
  return useQuery(orpc.accounting.compliance.history.queryOptions({ input: { days } }));
}

export function useSetDocumentRequirement() {
  const invalidateAccounting = useInvalidateAccounting();
  return useMutation({ ...orpc.accounting.compliance.setRequirement.mutationOptions(), onSuccess: invalidateAccounting });
}
