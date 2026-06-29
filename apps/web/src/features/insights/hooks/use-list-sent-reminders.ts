import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

interface UseListSentRemindersOptions {
  trackingId?: string;
  organizationIds?: string[];
  startDate?: string;
  endDate?: string;
  enabled?: boolean;
}

export function useListSentReminders({
  trackingId,
  organizationIds,
  startDate,
  endDate,
  enabled = true,
}: UseListSentRemindersOptions) {
  const { data, ...query } = useQuery(
    orpc.insights.listSentReminders.queryOptions({
      input: {
        trackingId,
        organizationIds,
        startDate,
        endDate,
        limit: 200,
      },
      enabled,
    }),
  );

  return {
    occurrences: data ?? [],
    ...query,
  };
}
