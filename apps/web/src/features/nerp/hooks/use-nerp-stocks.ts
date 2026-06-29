"use client";

import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

// `stocks.list` no nerp filtra por nome de produto, paginação
// (`offset`/`limit`), usuários e janela de datas — sem filtro por
// `productId`/`warehouseId`.
export function useNerpStocks(input?: {
  name?: string;
  offset?: number;
  limit?: number;
  userIds?: string[];
  dateInit?: Date;
  dateEnd?: Date;
}) {
  return useQuery(orpc.nerp.stocks.list.queryOptions({ input: input ?? {} }));
}
