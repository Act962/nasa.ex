"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

/** Mesmo conteúdo em várias contas do Instagram (spec 0074): contas do grupo e ações sobre ele. */

function useInvalidatePlanner() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: orpc.nasaPlanner.key() });
}

export function usePlannerPublishGroup(postId: string | null, { enabled = true }: { enabled?: boolean } = {}) {
  const isEnabled = enabled && Boolean(postId);
  const { data, isLoading } = useQuery({
    ...orpc.nasaPlanner.posts.group.get.queryOptions({ input: { postId: postId ?? "" } }),
    enabled: isEnabled,
  });
  return { groupPosts: data?.posts ?? [], isLoading: isEnabled && isLoading };
}

export type PublishGroupPost = ReturnType<typeof usePlannerPublishGroup>["groupPosts"][number];

export function useSetPlannerGroupAccounts() {
  const invalidatePlanner = useInvalidatePlanner();
  return useMutation(orpc.nasaPlanner.posts.group.setAccounts.mutationOptions({ onSuccess: invalidatePlanner }));
}

export function useSetPlannerGroupDetached() {
  const invalidatePlanner = useInvalidatePlanner();
  return useMutation(orpc.nasaPlanner.posts.group.setDetached.mutationOptions({ onSuccess: invalidatePlanner }));
}
