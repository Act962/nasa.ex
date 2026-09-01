"use client";

import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

export type ProjectionHorizon = 3 | 6 | 12;

interface ProjectionParams {
  horizonMonths?: ProjectionHorizon;
  trendWindowMonths?: number;
  categoryIds?: string[];
}

export function usePaymentProjection({
  horizonMonths = 6,
  trendWindowMonths = 6,
  categoryIds,
}: ProjectionParams = {}) {
  return useQuery(
    orpc.payment.projection.get.queryOptions({
      input: {
        horizonMonths,
        trendWindowMonths,
        ...(categoryIds && categoryIds.length > 0 ? { categoryIds } : {}),
      },
    }),
  );
}
