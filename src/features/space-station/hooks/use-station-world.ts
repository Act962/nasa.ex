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
    // Token tem TTL de 6h. Cada mint gera um JWT NOVO, e a connection effect do
    // use-sfu-room reconecta a Room quando o token muda de identidade — então um
    // refetch no meio da sessão derrubaria a mídia de todos (mic/cam resetam).
    // staleTime Infinity + sem refetch em focus/reconnect evita esse churn; um
    // novo mount (cache expirado por gcTime) ainda renova normalmente.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}
