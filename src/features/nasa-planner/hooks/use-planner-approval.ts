"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

/** Aprovação do Planner v2 (spec 0058, RF-3). */

function useInvalidatePlanner() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: orpc.nasaPlanner.key() });
}

export function usePlannerReviews(postId: string | null) {
  const { data, isLoading } = useQuery({
    ...orpc.nasaPlanner.approval.listReviews.queryOptions({ input: { postId: postId ?? "" } }),
    enabled: Boolean(postId),
  });
  return { reviews: data?.reviews ?? [], checklist: data?.checklist ?? [], isLoading };
}

export function useSubmitPlannerPostForApproval() {
  const invalidatePlanner = useInvalidatePlanner();
  return useMutation(orpc.nasaPlanner.approval.submit.mutationOptions({ onSuccess: invalidatePlanner }));
}

export function useRequestPlannerPostChanges() {
  const invalidatePlanner = useInvalidatePlanner();
  return useMutation(orpc.nasaPlanner.approval.requestChanges.mutationOptions({ onSuccess: invalidatePlanner }));
}

export function useApprovePlannerPost() {
  const invalidatePlanner = useInvalidatePlanner();
  return useMutation(orpc.nasaPlanner.approval.approve.mutationOptions({ onSuccess: invalidatePlanner }));
}

export function useCommentOnPlannerPost() {
  const invalidatePlanner = useInvalidatePlanner();
  return useMutation(orpc.nasaPlanner.approval.comment.mutationOptions({ onSuccess: invalidatePlanner }));
}
