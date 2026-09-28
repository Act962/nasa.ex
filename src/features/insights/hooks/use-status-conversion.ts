"use client";
import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

import type { DateRange } from "@/features/insights/types";

interface UseStatusConversionOptions {
  trackingId?: string;
  organizationIds?: string[];
  /** Vazio = todos os status do tracking. */
  statusIds?: string[];
  tagIds?: string[];
  dateRange?: DateRange;
  enabled?: boolean;
}

/**
 * Conversão por status no período. Só dispara com um tracking específico —
 * status pertence a um tracking, então "todos os trackings" não tem funil
 * único pra medir.
 */
export const useStatusConversion = ({
  trackingId,
  organizationIds,
  statusIds,
  tagIds,
  dateRange,
  enabled = true,
}: UseStatusConversionOptions) => {
  const hasSpecificTracking = Boolean(trackingId) && trackingId !== "ALL";

  const { data, ...query } = useQuery(
    orpc.insights.getStatusConversion.queryOptions({
      input: {
        trackingId: trackingId ?? "",
        organizationIds,
        statusIds,
        tagIds,
        startDate: dateRange?.from?.toISOString(),
        endDate: dateRange?.to?.toISOString(),
      },
      enabled: enabled && hasSpecificTracking,
    }),
  );

  return { conversion: data, ...query };
};
