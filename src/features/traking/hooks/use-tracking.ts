import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

export function useQueryTracking() {
  const { data, isLoading } = useQuery(orpc.tracking.list.queryOptions({}));

  return {
    trackings: data || [],
    isLoadingTrackings: isLoading,
  };
}
