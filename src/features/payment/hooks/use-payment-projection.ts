"use client";

import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

export type ProjectionHorizon = 3 | 6 | 12;

interface ProjectionParams {
  horizonMonths?: ProjectionHorizon;
  trendWindowMonths?: number;
}

export function usePaymentProjection({
  horizonMonths = 6,
  trendWindowMonths = 6,
}: ProjectionParams = {}) {
  return useQuery(
    orpc.payment.projection.get.queryOptions({
      input: { horizonMonths, trendWindowMonths },
    }),
  );
}
