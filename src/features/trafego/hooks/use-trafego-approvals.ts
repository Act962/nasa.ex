import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

/** Quem pode aprovar recomendação da equipe (spec 0130, CA-8). */
export const useTrafegoApprovalPermission = () =>
  useQuery({ ...orpc.trafego.approvals.permission.queryOptions(), staleTime: 5 * 60 * 1000 });

/** Aprovar a recomendação da equipe (spec 0130, RF-9): atualiza o pedido e a lista. */
export const useApproveTrafegoRecommendation = () => {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.trafego.approvals.approve.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: orpc.trafego.getOrder.key() });
        queryClient.invalidateQueries({ queryKey: orpc.trafego.listOrders.key() });
      },
    }),
  );
};

/** "Avaliar melhorias e aprovar" (spec 0132, RF-5): grava as melhorias da equipe no pedido. */
export const useApplyTrafegoReviewFixes = () => {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.trafego.approvals.applyReviewFixes.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: orpc.trafego.getOrder.key() });
        queryClient.invalidateQueries({ queryKey: orpc.trafego.listOrders.key() });
      },
    }),
  );
};
