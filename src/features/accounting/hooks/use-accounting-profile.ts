"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { useInvalidateAccounting } from "./use-accounting-invalidation";

export function useAccountingProfile() {
  return useQuery(orpc.accounting.profile.get.queryOptions({ input: {} }));
}

export function useUpdateAccountingProfile() {
  const invalidateAccounting = useInvalidateAccounting();
  return useMutation({
    ...orpc.accounting.profile.update.mutationOptions(),
    onSuccess: invalidateAccounting,
  });
}
