import { useSearchLead } from "@/hooks/use-search-lead";
import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

interface UseLeadSearchProps {
  search: string;
  trackingId: string;
  page: number;
  limit: number;
}

export function useLeadSearch({
  search,
  trackingId,
  page,
  limit,
}: UseLeadSearchProps) {
  const { isOpen } = useSearchLead();

  const { data, isLoading } = useQuery(
    orpc.leads.search.queryOptions({
      input: {
        search,
        trackingId,
        page,
        limit,
      },
      enabled: !!trackingId && isOpen,
    })
  );

  return {
    leads: data?.leads || [],
    isSearchLead: isLoading,
    total: data?.total || 0,
    totalPages: data?.totalPages || 0,
  };
}
