"use client";

import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

type SalesFilters = {
  courseId?: string;
  source?: "stripe_purchase" | "purchase" | "free_access" | "gift";
  status?: "active" | "refunded";
  search?: string;
  from?: Date;
  to?: Date;
  page?: number;
  pageSize?: number;
};

/** Vendas confirmadas (matrículas pagas) da org criadora. */
export function useNasaRouteSales(filters: SalesFilters = {}) {
  return useQuery({
    ...orpc.nasaRoute.creatorListSales.queryOptions({ input: filters }),
  });
}

type PendingFilters = {
  courseId?: string;
  statuses?: Array<"PENDING" | "PAID" | "EXPIRED" | "CANCELLED" | "REDEEMED">;
  search?: string;
  page?: number;
  pageSize?: number;
};

/** Compras pendentes / pagas aguardando resgate da org criadora. */
export function useNasaRoutePendingSales(filters: PendingFilters = {}) {
  return useQuery({
    ...orpc.nasaRoute.creatorListPendingSales.queryOptions({ input: filters }),
  });
}
