import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

export function leadProductsQueryKey(leadId: string) {
  return orpc.leads.listProducts.queryKey({ input: { leadId } });
}

export function useLeadProducts(leadId: string) {
  return useQuery(orpc.leads.listProducts.queryOptions({ input: { leadId } }));
}
