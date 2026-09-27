import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

// Gatilho do lead (spec 0038).

export function useLeadTriggers(leadId: string) {
  return useQuery(orpc.leads.listTriggers.queryOptions({ input: { leadId } }));
}

export function useSaveLeadTrigger(leadId: string) {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.leads.saveTrigger.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: orpc.leads.listTriggers.queryKey({ input: { leadId } }) });
        // O ícone de gatilho do card da lista depende disto.
        queryClient.invalidateQueries({ queryKey: ["conversations.list"] });
      },
    }),
  );
}
