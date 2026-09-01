"use client";

import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

export function usePaymentContracts(params: {
  search?: string;
  leadId?: string;
  includeAllStatuses?: boolean;
  page?: number;
  perPage?: number;
} = {}) {
  return useQuery(
    orpc.payment.contracts.listActive.queryOptions({
      input: {
        ...(params.search ? { search: params.search } : {}),
        ...(params.leadId ? { leadId: params.leadId } : {}),
        ...(params.includeAllStatuses !== undefined
          ? { includeAllStatuses: params.includeAllStatuses }
          : {}),
        ...(params.page ? { page: params.page } : {}),
        ...(params.perPage ? { perPage: params.perPage } : {}),
      },
    }),
  );
}
