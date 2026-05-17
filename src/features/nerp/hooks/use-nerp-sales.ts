"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

export function useNerpSales(input?: {
  customerId?: string;
  status?: "draft" | "pending" | "paid" | "canceled" | "refunded";
  fromDate?: string;
  toDate?: string;
  page?: number;
  pageSize?: number;
}) {
  return useQuery(orpc.nerp.sales.list.queryOptions({ input: input ?? {} }));
}

export function useNerpSale(id: string, enabled = true) {
  return useQuery({
    ...orpc.nerp.sales.get.queryOptions({ input: { id } }),
    enabled: Boolean(id) && enabled,
  });
}

export function useCreateNerpSale() {
  const qc = useQueryClient();
  return useMutation(
    orpc.nerp.sales.create.mutationOptions({
      onSuccess: () => qc.invalidateQueries({ queryKey: ["nerp"] }),
    }),
  );
}
