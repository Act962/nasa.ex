"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

/** Chaves de acesso de IA externa ao MCP do ÓRBITA (spec 0065). */

export function useExternalAiTokens() {
  const { data, isLoading } = useQuery(orpc.externalAi.tokens.list.queryOptions());
  return { tokens: data?.tokens ?? [], isLoading };
}

function useInvalidateTokens() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: orpc.externalAi.tokens.list.key() });
}

export function useCreateExternalAiToken() {
  const invalidate = useInvalidateTokens();
  return useMutation(orpc.externalAi.tokens.create.mutationOptions({ onSuccess: invalidate }));
}

export function useRevokeExternalAiToken() {
  const invalidate = useInvalidateTokens();
  return useMutation(orpc.externalAi.tokens.revoke.mutationOptions({ onSuccess: invalidate }));
}
