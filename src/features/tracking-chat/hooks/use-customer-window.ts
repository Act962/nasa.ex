import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

/**
 * Estado da janela de 24h de atendimento da Meta (Fase 9). Só relevante pra
 * trackings `META_CLOUD` — passe `enabled: false` pros demais pra não bater
 * no servidor. A procedure já devolve `{ applicable: false }` quando o
 * provider não é Meta, mas o `enabled` evita o round-trip.
 */
export const useCustomerWindow = (
  conversationId: string,
  options?: { enabled?: boolean },
) => {
  return useQuery({
    ...orpc.message.customerWindow.queryOptions({
      input: { conversationId },
    }),
    enabled: options?.enabled ?? true,
    // Recalcula periodicamente — a janela expira sozinha com o tempo.
    refetchInterval: 60_000,
  });
};
