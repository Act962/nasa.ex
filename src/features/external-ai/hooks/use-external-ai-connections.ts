"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

/** IAs conectadas por OAuth ao MCP do ÓRBITA (spec 0135, RF-11). */

export function useExternalAiConnections() {
  const { data, isLoading } = useQuery(orpc.externalAi.connections.list.queryOptions());
  return { connections: data?.connections ?? [], isLoading };
}

export function useDisconnectExternalAi() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.externalAi.connections.disconnect.mutationOptions({
      onSuccess: () => queryClient.invalidateQueries({ queryKey: orpc.externalAi.connections.list.key() }),
    }),
  );
}
