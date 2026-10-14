import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// Venda guiada com aprovação dos setores (spec 0104).

export function useSalesApprovers() {
  return useQuery(orpc.nerp.salesApprovals.listApprovers.queryOptions());
}

function useInvalidateSalesApprovals() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: orpc.nerp.salesApprovals.key() });
}

export function useSaveSalesApprover() {
  const invalidate = useInvalidateSalesApprovals();
  return useMutation(orpc.nerp.salesApprovals.saveApprover.mutationOptions({ onSuccess: invalidate }));
}

export function useRemoveSalesApprover() {
  const invalidate = useInvalidateSalesApprovals();
  return useMutation(orpc.nerp.salesApprovals.removeApprover.mutationOptions({ onSuccess: invalidate }));
}

export function useSaveSalesApprovalTemplates() {
  const invalidate = useInvalidateSalesApprovals();
  return useMutation(orpc.nerp.salesApprovals.saveTemplates.mutationOptions({ onSuccess: invalidate }));
}

export function useInstallGuidedSaleFlows() {
  return useMutation(orpc.nerp.salesApprovals.installFlows.mutationOptions());
}

export function useOrderApprovals(orderId: string, options: { enabled?: boolean } = {}) {
  return useQuery({
    ...orpc.nerp.salesApprovals.listOrderApprovals.queryOptions({ input: { orderId } }),
    enabled: options.enabled ?? true,
    refetchInterval: 15_000,
  });
}

export function useDecideOrderApproval() {
  const invalidate = useInvalidateSalesApprovals();
  const queryClient = useQueryClient();
  return useMutation(
    orpc.nerp.salesApprovals.decide.mutationOptions({
      onSuccess: () => {
        invalidate();
        queryClient.invalidateQueries({ queryKey: orpc.leads.listProducts.key() });
      },
    }),
  );
}
