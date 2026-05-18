"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

function useInvalidate() {
  const qc = useQueryClient();
  return () =>
    qc.invalidateQueries({ queryKey: ["commentsApp", "automations"] });
}

export function useCreateCommentsListener() {
  const invalidate = useInvalidate();
  return useMutation(
    orpc.commentsApp.listener.create.mutationOptions({ onSuccess: invalidate }),
  );
}

export function useUpdateCommentsListener() {
  const invalidate = useInvalidate();
  return useMutation(
    orpc.commentsApp.listener.update.mutationOptions({ onSuccess: invalidate }),
  );
}
