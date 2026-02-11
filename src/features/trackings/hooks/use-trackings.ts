import { orpc } from "@/lib/orpc";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";

export const useQueryTrackings = () => {
  const { data, isLoading } = useQuery(orpc.tracking.list.queryOptions());

  return {
    trackings: data ?? [],
    isLoading,
  };
};

export const useSuspenseTrackings = () => {
  return useSuspenseQuery(orpc.tracking.list.queryOptions());
};
