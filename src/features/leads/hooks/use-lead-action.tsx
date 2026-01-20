import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

interface UseLeadActionProps {
  leadId: string;
}

export function useLeadAction({ leadId }: UseLeadActionProps) {
  const { data, isLoading } = useQuery(
    orpc.leads.listActions.queryOptions({ input: { leadId } }),
  );
  return { data, isLoading };
}
