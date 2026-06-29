"use client";

import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

export function useActiveMetaAccount() {
  const query = useQuery(orpc.integrations.getActiveMetaSelection.queryOptions());
  return {
    adAccountId: query.data?.adAccountId ?? null,
    connected: query.data?.connected ?? false,
    isLoading: query.isLoading,
  };
}

export function useAvailableMetaAccounts() {
  return useQuery(orpc.integrations.listAvailableMetaAccounts.queryOptions());
}
