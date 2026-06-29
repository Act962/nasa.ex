"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

function useInvalidate() {
  const qc = useQueryClient();
  return () =>
    qc.invalidateQueries({ queryKey: ["commentsApp", "sorteio"] });
}

export function useCommentsSorteios() {
  return useQuery(orpc.commentsApp.sorteio.getMany.queryOptions({ input: {} }));
}

export function useCommentsSorteio(id: string, enabled = true) {
  return useQuery({
    ...orpc.commentsApp.sorteio.getOne.queryOptions({ input: { id } }),
    enabled: Boolean(id) && enabled,
  });
}

export function useCommentsSorteioComments(
  id: string,
  input?: { cursor?: string | null; limit?: number },
) {
  return useQuery({
    ...orpc.commentsApp.sorteio.listComments.queryOptions({
      input: { id, ...(input ?? {}) },
    }),
    enabled: Boolean(id),
  });
}

export function useCreateCommentsSorteio() {
  const invalidate = useInvalidate();
  return useMutation(
    orpc.commentsApp.sorteio.create.mutationOptions({ onSuccess: invalidate }),
  );
}

export function useUpdateCommentsSorteio() {
  const invalidate = useInvalidate();
  return useMutation(
    orpc.commentsApp.sorteio.update.mutationOptions({ onSuccess: invalidate }),
  );
}

export function useDeleteCommentsSorteio() {
  const invalidate = useInvalidate();
  return useMutation(
    orpc.commentsApp.sorteio.delete.mutationOptions({ onSuccess: invalidate }),
  );
}

export function useAddCommentsSorteioPosts() {
  const invalidate = useInvalidate();
  return useMutation(
    orpc.commentsApp.sorteio.addPosts.mutationOptions({ onSuccess: invalidate }),
  );
}

export function useRemoveCommentsSorteioPost() {
  const invalidate = useInvalidate();
  return useMutation(
    orpc.commentsApp.sorteio.removePost.mutationOptions({
      onSuccess: invalidate,
    }),
  );
}

export function useStartCommentsSorteioCollecting() {
  const invalidate = useInvalidate();
  return useMutation(
    orpc.commentsApp.sorteio.startCollecting.mutationOptions({
      onSuccess: invalidate,
    }),
  );
}

export function useCloseCommentsSorteioCollecting() {
  const invalidate = useInvalidate();
  return useMutation(
    orpc.commentsApp.sorteio.closeCollecting.mutationOptions({
      onSuccess: invalidate,
    }),
  );
}

export function useResyncCommentsSorteio() {
  const invalidate = useInvalidate();
  return useMutation(
    orpc.commentsApp.sorteio.resync.mutationOptions({ onSuccess: invalidate }),
  );
}

export function useDrawCommentsSorteio() {
  const invalidate = useInvalidate();
  return useMutation(
    orpc.commentsApp.sorteio.draw.mutationOptions({ onSuccess: invalidate }),
  );
}

export function useReplaceCommentsSorteioWinner() {
  const invalidate = useInvalidate();
  return useMutation(
    orpc.commentsApp.sorteio.replaceWinner.mutationOptions({
      onSuccess: invalidate,
    }),
  );
}
