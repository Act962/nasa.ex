"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

function useInvalidate() {
  const qc = useQueryClient();
  return () =>
    qc.invalidateQueries({ queryKey: ["commentsApp", "automations"] });
}

export function useCreateCommentsTrigger() {
  const invalidate = useInvalidate();
  return useMutation(
    orpc.commentsApp.trigger.create.mutationOptions({ onSuccess: invalidate }),
  );
}

export function useDeleteCommentsTrigger() {
  const invalidate = useInvalidate();
  return useMutation(
    orpc.commentsApp.trigger.delete.mutationOptions({ onSuccess: invalidate }),
  );
}
