"use client";

import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

export function useNerpStocks(input?: {
  productId?: string;
  warehouseId?: string;
  page?: number;
  pageSize?: number;
}) {
  return useQuery(orpc.nerp.stocks.list.queryOptions({ input: input ?? {} }));
}
