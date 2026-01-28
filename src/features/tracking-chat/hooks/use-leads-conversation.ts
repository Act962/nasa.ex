import { orpc } from "@/lib/orpc";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";

export function useSuspenseLeadsByWhats() {
  return useSuspenseQuery(orpc.leads.listLeadByWhats.queryOptions({}));
}

export function useQueryLeadsByWhats() {
  const { data, isLoading } = useQuery(
    orpc.leads.listLeadByWhats.queryOptions({}),
  );
  return { data, isLoading };
}
