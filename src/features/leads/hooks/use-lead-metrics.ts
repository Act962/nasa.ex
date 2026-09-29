import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

// Métricas do "Auditar Lead" (spec 0035).

export function useLeadMetrics(leadId: string) {
  return useQuery(orpc.leads.getMetrics.queryOptions({ input: { leadId } }));
}

export function useAuditLead(leadId: string) {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.leads.auditLead.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: orpc.leads.getMetrics.queryKey({ input: { leadId } }) });
        queryClient.invalidateQueries({ queryKey: orpc.leads.get.queryKey({ input: { id: leadId } }) });
      },
    }),
  );
}
