"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

function useInvalidate() {
  const qc = useQueryClient();
  return () =>
    qc.invalidateQueries({ queryKey: ["commentsApp", "automations"] });
}

export function useCommentsAutomations() {
  return useQuery(orpc.commentsApp.automations.getMany.queryOptions({ input: {} }));
}

export function useCommentsAutomation(id: string, enabled = true) {
  return useQuery({
    ...orpc.commentsApp.automations.getOne.queryOptions({ input: { id } }),
    enabled: Boolean(id) && enabled,
  });
}

export function useCreateCommentsAutomation() {
  const invalidate = useInvalidate();
  return useMutation(
    orpc.commentsApp.automations.create.mutationOptions({ onSuccess: invalidate }),
  );
}

export function useDeleteCommentsAutomation() {
  const invalidate = useInvalidate();
  return useMutation(
    orpc.commentsApp.automations.delete.mutationOptions({ onSuccess: invalidate }),
  );
}

export function useUpdateCommentsAutomationName() {
  const invalidate = useInvalidate();
  return useMutation(
    orpc.commentsApp.automations.updateName.mutationOptions({
      onSuccess: invalidate,
    }),
  );
}

export function useUpdateCommentsAutomationActive() {
  const invalidate = useInvalidate();
  return useMutation(
    orpc.commentsApp.automations.updateActive.mutationOptions({
      onSuccess: invalidate,
    }),
  );
}

export function useSaveCommentsAutomationPost() {
  const invalidate = useInvalidate();
  return useMutation(
    orpc.commentsApp.automations.savePost.mutationOptions({ onSuccess: invalidate }),
  );
}

export function useDeleteCommentsAutomationPost() {
  const invalidate = useInvalidate();
  return useMutation(
    orpc.commentsApp.automations.deletePost.mutationOptions({
      onSuccess: invalidate,
    }),
  );
}

export function useUpdateCommentsAutomationIntegrationToken() {
  const invalidate = useInvalidate();
  return useMutation(
    orpc.commentsApp.automations.updateIntegrationToken.mutationOptions({
      onSuccess: invalidate,
    }),
  );
}
