"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

function useInvalidateAutomations() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: orpc.comments.key() });
}

/** Automações de uma conta (spec 0069, RF-13). */
export function useCommentsAutomations(channelId: string | null) {
  return useQuery({
    ...orpc.comments.automations.list.queryOptions({ input: { channelId: channelId ?? "" } }),
    enabled: Boolean(channelId),
  });
}

export function useCommentsAutomation(id: string, enabled = true) {
  return useQuery({
    ...orpc.comments.automations.get.queryOptions({ input: { id } }),
    enabled: Boolean(id) && enabled,
  });
}

export function useCreateCommentsAutomation() {
  const invalidate = useInvalidateAutomations();
  return useMutation(
    orpc.comments.automations.create.mutationOptions({ onSuccess: invalidate }),
  );
}

export function useRenameCommentsAutomation() {
  const invalidate = useInvalidateAutomations();
  return useMutation(
    orpc.comments.automations.rename.mutationOptions({ onSuccess: invalidate }),
  );
}

export function useSetCommentsAutomationActive() {
  const invalidate = useInvalidateAutomations();
  return useMutation(
    orpc.comments.automations.setActive.mutationOptions({
      onSuccess: invalidate,
    }),
  );
}

export function useDeleteCommentsAutomation() {
  const invalidate = useInvalidateAutomations();
  return useMutation(
    orpc.comments.automations.delete.mutationOptions({ onSuccess: invalidate }),
  );
}

export function useSaveCommentsTrigger() {
  const invalidate = useInvalidateAutomations();
  return useMutation(
    orpc.comments.automations.saveTrigger.mutationOptions({
      onSuccess: invalidate,
    }),
  );
}

export function useCommentsRuns({ channelId, automationId }: { channelId?: string | null; automationId?: string }) {
  return useQuery(
    orpc.comments.automations.listRuns.queryOptions({
      input: { channelId: channelId ?? undefined, automationId, limit: 20 },
    }),
  );
}
