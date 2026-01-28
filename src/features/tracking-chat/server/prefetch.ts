import { orpc } from "@/lib/orpc";
import type { QueryClient } from "@tanstack/react-query";

export function prefetchLeadsByWhats(queryClient: QueryClient) {
  return queryClient.prefetchQuery(orpc.leads.listLeadByWhats.queryOptions({}));
}
