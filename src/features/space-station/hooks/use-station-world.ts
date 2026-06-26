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
  options?: {
    enabled?: boolean;
    /** Sufixo por aba pra identity do LiveKit (usuário logado). */
    sessionId?: string;
    /** Identidade do convidado (sem sessão) — casa com a presença do Pusher. */
    guestId?: string;
    /** Nome de exibição do convidado no mundo. */
    guestName?: string;
  },
) {
  return useQuery({
    ...orpc.spaceStation.joinWorld.queryOptions({
      input: {
        stationId: stationId ?? "",
        sessionId: options?.sessionId,
        guestId: options?.guestId,
        guestName: options?.guestName,
      },
    }),
    enabled: Boolean(stationId) && (options?.enabled ?? true),
    // Erros de autorização/validação (4xx) não são recuperáveis — não retry, pra
    // não segurar o fallback mesh por segundos (ex.: convidado numa station
    // não-OPEN recebe FORBIDDEN). Falhas transitórias (mint do LiveKit, rede)
    // tentam 1x antes de cair no mesh.
    retry: (failureCount, error) => {
      const code = (error as { code?: string } | null)?.code;
      const nonRetryable = new Set([
        "FORBIDDEN",
        "BAD_REQUEST",
        "UNAUTHORIZED",
        "NOT_FOUND",
      ]);
      if (code && nonRetryable.has(code)) return false;
      return failureCount < 1;
    },
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
