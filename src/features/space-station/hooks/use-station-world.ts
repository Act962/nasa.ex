"use client";

import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

/**
 * Obtém o token SFU pra entrar no mundo da station (LiveKit Room).
 *
 * Padrão (CLAUDE.md regra 9): componente nunca chama `orpc.*` direto — só este
 * hook. Mantém invalidação/cache padronizados e o contrato fácil de evoluir.
 *
 * - `enabled` permite postergar o join até o usuário estar pronto (ex: depois
 *   da `station-access-gate` liberar entrada).
 * - O retorno carrega `sfuConfigured`: quando `false`, o LiveKit não está
 *   configurado (faltam env vars) e o cliente cai no fallback de mesh.
 */
export function useJoinWorld(
  stationId: string | null | undefined,
  options?: { enabled?: boolean },
) {
  return useQuery({
    ...orpc.spaceStation.joinWorld.queryOptions({
      input: { stationId: stationId ?? "" },
    }),
    enabled: Boolean(stationId) && (options?.enabled ?? true),
    // Token tem TTL de 6h (default do mintLiveKitToken). Refetch generoso
    // mantém a sala viva sem renovar a cada navegação.
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
