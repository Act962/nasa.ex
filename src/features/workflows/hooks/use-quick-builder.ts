import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import type { QuickStep } from "@/features/workflows/lib/quick-builder/steps";

// Construtor rápido de Gatilhos Automáticos (spec 0039).

export function useQuickDraftWorkflow() {
  return useMutation(orpc.workflow.quick.draft.mutationOptions());
}

export function useQuickDuplicates(params: { trackingId: string; leadId?: string; steps: QuickStep[] }) {
  return useQuery({
    ...orpc.workflow.quick.checkDuplicates.queryOptions({
      input: { trackingId: params.trackingId, leadId: params.leadId, steps: params.steps },
    }),
    enabled: params.steps.length > 0 && Boolean(params.trackingId),
    staleTime: 10_000,
  });
}

export function useQuickCreateWorkflow() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.workflow.quick.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: orpc.workflow.list.key() });
      },
    }),
  );
}
