import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

/** Execuções e fila de aprovação do ASTRO COMMANDER (spec 0023). */

export function useAstroRuns(params: { commandId?: string; limit?: number } = {}) {
  const query = useQuery(
    orpc.astroCommander.runs.list.queryOptions({
      input: { commandId: params.commandId, limit: params.limit ?? 30 },
    }),
  );
  return {
    runs: query.data?.runs ?? [],
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}

export function useAstroRun(id: string, enabled = true) {
  const query = useQuery({
    ...orpc.astroCommander.runs.get.queryOptions({ input: { id } }),
    enabled: enabled && Boolean(id),
  });
  return {
    run: query.data?.run ?? null,
    pendingActions: query.data?.pendingActions ?? [],
    isLoading: query.isLoading,
  };
}

export function useAstroUsage(params: { commandId?: string; days?: number } = {}) {
  const query = useQuery(
    orpc.astroCommander.runs.usage.queryOptions({
      input: { commandId: params.commandId, days: params.days ?? 7 },
    }),
  );
  return { usage: query.data ?? null, isLoading: query.isLoading };
}

export function useAstroApprovals() {
  const query = useQuery(
    orpc.astroCommander.approvals.list.queryOptions({ input: {} }),
  );
  return {
    approvals: query.data?.approvals ?? [],
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}

function useInvalidateApprovals() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["astroCommander"] });
    queryClient.invalidateQueries({
      queryKey: orpc.astroCommander.approvals.list.queryKey(),
    });
  };
}

export function useApproveAstroAction() {
  const invalidate = useInvalidateApprovals();
  return useMutation(
    orpc.astroCommander.approvals.approve.mutationOptions({
      onSuccess: invalidate,
    }),
  );
}

export function useRejectAstroAction() {
  const invalidate = useInvalidateApprovals();
  return useMutation(
    orpc.astroCommander.approvals.reject.mutationOptions({
      onSuccess: invalidate,
    }),
  );
}
