"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["commentsApp"] });
}

export function useCommentsPosts(input?: { cursor?: string }) {
  return useQuery(orpc.commentsApp.user.getPosts.queryOptions({ input: input ?? {} }));
}

export function useUpdateCommentsProfile() {
  const invalidate = useInvalidate();
  return useMutation(
    orpc.commentsApp.user.updateProfile.mutationOptions({
      onSuccess: invalidate,
    }),
  );
}

export function useRefreshCommentsTokens() {
  const invalidate = useInvalidate();
  return useMutation(
    orpc.commentsApp.user.refreshTokens.mutationOptions({
      onSuccess: invalidate,
    }),
  );
}

export function useCommentsOnIntegration() {
  const invalidate = useInvalidate();
  return useMutation(
    orpc.commentsApp.user.onIntegration.mutationOptions({
      onSuccess: invalidate,
    }),
  );
}
