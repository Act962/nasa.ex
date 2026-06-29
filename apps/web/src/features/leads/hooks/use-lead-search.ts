import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

interface UseLeadSearchOptions {
  statusId?: string;
  trackingId?: string;
  search?: string;
  page?: number;
  limit?: number;
  enabled?: boolean;
}

export const useLeadSearch = ({
  statusId,
  trackingId,
  search,
  page = 1,
  limit = 20,
  enabled = true,
}: UseLeadSearchOptions) => {
  const { data, isLoading, isFetching } = useQuery(
    orpc.leads.search.queryOptions({
      input: {
        statusId,
        trackingId,
        search,
        page,
        limit,
      },
      enabled: enabled && (!!trackingId || !!search),
    }),
  );

  return {
    leads: data?.leads ?? [],
    total: data?.total ?? 0,
    totalPages: data?.totalPages ?? 0,
    isLoading,
    isFetching,
  };
};
