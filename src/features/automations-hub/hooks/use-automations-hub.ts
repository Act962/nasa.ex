import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

/** Automações da empresa que a pessoa alcança, reunidas (spec 0090, seção A). */
export function useAutomationsOverview(options?: { enabled?: boolean }) {
  return useQuery({
    ...orpc.automationsHub.overview.queryOptions(),
    enabled: options?.enabled ?? true,
    staleTime: 15_000,
  });
}

function useInvalidateAutomationsOverview() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: orpc.automationsHub.overview.queryKey() });
}

/** Liga e desliga usando a rota que cada tipo de automação já tem. */
export function useToggleTrackingFlow() {
  const invalidate = useInvalidateAutomationsOverview();
  return useMutation(orpc.workflow.update.updateIsActive.mutationOptions({ onSuccess: invalidate }));
}

export function useToggleWorkspaceFlow() {
  const invalidate = useInvalidateAutomationsOverview();
  return useMutation(orpc.workspaceWorkflow.updateIsActive.mutationOptions({ onSuccess: invalidate }));
}

export function useToggleCommentsAutomation() {
  const invalidate = useInvalidateAutomationsOverview();
  return useMutation(orpc.comments.automations.setActive.mutationOptions({ onSuccess: invalidate }));
}
