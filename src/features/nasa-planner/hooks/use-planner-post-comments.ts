"use client";

import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

/**
 * Comentários do post publicado no Instagram: lista paginada, responder, ocultar e apagar.
 * As ações recarregam a lista também quando falham: o comentário pode ter sido apagado direto no Instagram.
 */

export function usePlannerPostComments(postId: string, { enabled = true }: { enabled?: boolean } = {}) {
  const { data, isLoading, isFetching, error, fetchNextPage, hasNextPage, isFetchingNextPage, refetch } = useInfiniteQuery(
    orpc.nasaPlanner.posts.instagramComments.list.infiniteOptions({
      input: (after: string | undefined) => ({ postId, after }),
      initialPageParam: undefined,
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
      enabled,
    }),
  );
  return {
    comments: data?.pages.flatMap((page) => page.comments) ?? [],
    isLoading,
    isFetching,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  };
}

function useInvalidatePostComments() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: orpc.nasaPlanner.posts.instagramComments.list.key() });
    void queryClient.invalidateQueries({ queryKey: orpc.nasaPlanner.posts.metrics.key() });
  };
}

export function useReplyToPlannerComment() {
  const invalidate = useInvalidatePostComments();
  return useMutation(orpc.nasaPlanner.posts.instagramComments.reply.mutationOptions({ onSettled: invalidate }));
}

export function useSetPlannerCommentHidden() {
  const invalidate = useInvalidatePostComments();
  return useMutation(orpc.nasaPlanner.posts.instagramComments.setHidden.mutationOptions({ onSettled: invalidate }));
}

export function useDeletePlannerComment() {
  const invalidate = useInvalidatePostComments();
  return useMutation(orpc.nasaPlanner.posts.instagramComments.delete.mutationOptions({ onSettled: invalidate }));
}

/** "Editar" = publica o texto novo e apaga o antigo (o Instagram não edita comentário). */
export function useEditOwnPlannerComment() {
  const invalidate = useInvalidatePostComments();
  return useMutation(orpc.nasaPlanner.posts.instagramComments.editOwn.mutationOptions({ onSettled: invalidate }));
}
