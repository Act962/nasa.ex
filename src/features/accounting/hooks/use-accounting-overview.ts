"use client";

import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

export function useAccountingOverview() {
  return useQuery(orpc.accounting.overview.get.queryOptions({ input: {} }));
}
