"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

export function usePaymentCustomerSearch(search: string, options?: { enabled?: boolean }) {
  return useQuery({
    ...orpc.payment.customers.search.queryOptions({ input: { search: search || undefined } }),
    enabled: options?.enabled ?? true,
    placeholderData: keepPreviousData,
  });
}
