"use client";

import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

interface UseInsightsMembersOptions {
  organizationIds?: string[];
  trackingIds?: string[];
  enabled?: boolean;
}

export function useInsightsMembers({
  organizationIds,
  trackingIds,
  enabled = true,
}: UseInsightsMembersOptions) {
  const { data, ...rest } = useQuery({
    ...orpc.insights.listInsightsMembers.queryOptions({
      input: { organizationIds, trackingIds },
    }),
    enabled,
  });

  return {
    members: data?.members ?? [],
    ...rest,
  };
}
