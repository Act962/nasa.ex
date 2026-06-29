"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

export function useNerpConnection() {
  const query = useQuery(
    orpc.nerp.getConnectionStatus.queryOptions({ input: {} }),
  );
  const data = query.data;

  return {
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    refetch: query.refetch,
    connected: data?.connected ?? false,
    isActive: data && data.connected ? data.isActive : false,
    nerpOrgId: data && data.connected ? data.nerpOrgId : null,
    scopes: data && data.connected ? data.scopes : [],
    lastSyncAt: data && data.connected ? data.lastSyncAt : null,
    lastErrorAt: data && data.connected ? data.lastErrorAt : null,
    lastErrorMessage: data && data.connected ? data.lastErrorMessage : null,
    raw: data ?? null,
  };
}

export function useDisconnectNerp() {
  const qc = useQueryClient();
  return useMutation(
    orpc.nerp.disconnect.mutationOptions({
      onSuccess: () => qc.invalidateQueries({ queryKey: ["nerp"] }),
    }),
  );
}

/**
 * Faz uma chamada real ao nerp (`org.get`) pra validar a saúde da conexão.
 * Usa fetch direto no `/api/rpc/nerp/org/get` pra não interferir com o cache
 * da query principal e poder ser disparada on-demand.
 */
export function useTestNerpConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/rpc/nerp/org/get", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { message?: string }).message ?? `HTTP ${res.status}`,
        );
      }
      return (await res.json()) as { org: { id: string; name: string } };
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["nerp"] }),
  });
}
