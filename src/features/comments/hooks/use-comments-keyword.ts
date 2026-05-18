"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

function useInvalidate() {
  const qc = useQueryClient();
  return () =>
    qc.invalidateQueries({ queryKey: ["commentsApp", "automations"] });
}

export function useCreateCommentsKeyword() {
  const invalidate = useInvalidate();
  return useMutation(
    orpc.commentsApp.keyword.create.mutationOptions({ onSuccess: invalidate }),
  );
}

export function useDeleteCommentsKeyword() {
  const invalidate = useInvalidate();
  return useMutation(
    orpc.commentsApp.keyword.delete.mutationOptions({ onSuccess: invalidate }),
  );
}
