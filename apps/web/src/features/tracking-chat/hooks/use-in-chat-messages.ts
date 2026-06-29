/**
 * Hook de listagem paginada de mensagens do In-Chat (lado do lead).
 *
 * Espelha o padrão usado pelo `tracking-chat/body.tsx` com
 * `orpc.message.list.infiniteOptions`: scroll infinito reverso, cursor
 * por id, 30 mensagens por página. Cada página retorna em ordem `desc`
 * (mais nova primeiro) — o consumidor reverte pra exibir asc.
 *
 * Auth é via cookie `nasa_inchat_lead` setado pelo `/identify` — a
 * procedure pública `orpc.inChat.listMessages` lê o cookie do header.
 */

import { useInfiniteQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

export function useInChatMessages(slug: string) {
  return useInfiniteQuery(
    orpc.inChat.listMessages.infiniteOptions({
      input: (pageParam: string | undefined) => ({
        slug,
        cursor: pageParam,
        // TEMP: limite baixo pra testar scroll infinito com poucas mensagens.
        // Voltar pra 30 quando terminar de validar.
        limit: 5,
      }),
      queryKey: ["in-chat.messages", slug],
      initialPageParam: undefined as string | undefined,
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    }),
  );
}
