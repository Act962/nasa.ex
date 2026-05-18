"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

function useInvalidate() {
  const qc = useQueryClient();
  return () =>
    qc.invalidateQueries({ queryKey: ["commentsApp", "notifications"] });
}

export function useCommentsNotifications() {
  return useQuery(
    orpc.commentsApp.notifications.getMany.queryOptions({ input: {} }),
  );
}

export function useMarkCommentsNotificationRead() {
  const invalidate = useInvalidate();
  return useMutation(
    orpc.commentsApp.notifications.markAsRead.mutationOptions({
      onSuccess: invalidate,
    }),
  );
}
