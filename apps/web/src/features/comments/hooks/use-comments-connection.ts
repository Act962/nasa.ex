"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

export function useCommentsConnection() {
  const query = useQuery(
    orpc.commentsApp.getConnectionStatus.queryOptions({ input: {} }),
  );
  const data = query.data;

  return {
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    refetch: query.refetch,
    connected: data?.connected ?? false,
    isActive: data && data.connected ? data.isActive : false,
    userId: data && data.connected ? data.userId : null,
    scopes: data && data.connected ? data.scopes : [],
    lastSyncAt: data && data.connected ? data.lastSyncAt : null,
    lastErrorAt: data && data.connected ? data.lastErrorAt : null,
    lastErrorMessage:
      data && data.connected ? data.lastErrorMessage : null,
    raw: data ?? null,
  };
}

export function useDisconnectComments() {
  const qc = useQueryClient();
  return useMutation(
    orpc.commentsApp.disconnect.mutationOptions({
      onSuccess: () => qc.invalidateQueries({ queryKey: ["commentsApp"] }),
    }),
  );
}
