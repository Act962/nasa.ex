import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

/** Leads sem resposta por canal, para o contador nos ícones do Tracking Chat. */

/** Atualiza sozinho: o contador precisa refletir o lead que acabou de chamar. */
const REFRESH_MS = 30_000;

export function useUnansweredCounts(trackingId: string | null) {
  const query = useQuery({
    ...orpc.conversation.unansweredCounts.queryOptions({
      input: { trackingId: trackingId ?? "" },
    }),
    enabled: Boolean(trackingId),
    refetchInterval: REFRESH_MS,
  });
  return {
    byChannel: query.data?.byChannel ?? {},
    total: query.data?.total ?? 0,
  };
}

/**
 * Somatória de todos os canais e trackings — a bolinha no ícone Chat do menu
 * lateral (spec 0030, RF-7). Quem está em outra tela vê que tem lead esperando
 * sem precisar abrir o Chat.
 */
export function useUnansweredTotal() {
  const query = useQuery({
    ...orpc.conversation.unansweredTotal.queryOptions(),
    refetchInterval: REFRESH_MS,
    refetchOnWindowFocus: true,
  });
  return { total: query.data?.total ?? 0 };
}
