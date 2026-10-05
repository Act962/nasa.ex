"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

/** Programar, reprogramar, desprogramar, publicar agora e tentar de novo (spec 0057). */

function useInvalidatePlanner() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: orpc.nasaPlanner.key() });
}

export function usePlannerPublishAccounts(organizationIds?: string[]) {
  const { data, isLoading } = useQuery(orpc.nasaPlanner.publishAccounts.list.queryOptions({ input: { organizationIds } }));
  return { accounts: data?.accounts ?? [], isLoading };
}

export function useSchedulePlannerPostV2() {
  const invalidatePlanner = useInvalidatePlanner();
  return useMutation(orpc.nasaPlanner.posts.schedule.mutationOptions({ onSuccess: invalidatePlanner }));
}

export function useUnschedulePlannerPost() {
  const invalidatePlanner = useInvalidatePlanner();
  return useMutation(orpc.nasaPlanner.posts.unschedule.mutationOptions({ onSuccess: invalidatePlanner }));
}

export function usePublishPlannerPostNow() {
  const invalidatePlanner = useInvalidatePlanner();
  return useMutation(orpc.nasaPlanner.posts.publishNow.mutationOptions({ onSuccess: invalidatePlanner }));
}

export function useRetryPlannerPublish() {
  const invalidatePlanner = useInvalidatePlanner();
  return useMutation(orpc.nasaPlanner.posts.retryPublish.mutationOptions({ onSuccess: invalidatePlanner }));
}

/** Números reais do post publicado (Meta). Só busca quando o post já saiu. */
export function usePlannerPostMetrics(postId: string, { enabled = true }: { enabled?: boolean } = {}) {
  const { data, isLoading, isFetching, refetch } = useQuery({
    ...orpc.nasaPlanner.posts.metrics.queryOptions({ input: { postId } }),
    enabled,
    staleTime: 60_000,
  });
  return { postMetrics: data ?? null, isLoading, isFetching, refetch };
}
