"use client";

import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const MIN_PHONE_DIGITS = 10;

export function useSaleClientLookup(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return useQuery({
    ...orpc.forge.sales.lookupClient.queryOptions({ input: { phone: digits } }),
    enabled: digits.length >= MIN_PHONE_DIGITS,
  });
}

export function useRegisterSale() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.forge.sales.register.mutationOptions(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orpc.forge.proposals.list.key() });
      qc.invalidateQueries({ queryKey: orpc.forge.sales.listReceipts.key() });
      qc.invalidateQueries({ queryKey: orpc.forge.dashboard.get.key() });
    },
  });
}

export function useSaleReceipts({ search, page }: { search: string; page: number }) {
  return useQuery({
    ...orpc.forge.sales.listReceipts.queryOptions({ input: { search: search.trim() || undefined, page } }),
    placeholderData: (previous) => previous,
  });
}
