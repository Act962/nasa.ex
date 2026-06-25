import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

/**
 * Hooks de templates HSM (Fase 9 — Roadmap WhatsApp Oficial).
 *
 * `useWhatsAppTemplates` lista os templates aprovados da WABA (fetch ao vivo
 * via `integrations.listWhatsAppTemplates`) — só faz sentido pra trackings
 * `META_CLOUD`, então exponha `enabled`. `useCreateTemplateMessage` despacha
 * o envio via `message.createTemplate` e invalida a lista de mensagens.
 */

export const useWhatsAppTemplates = (
  trackingId: string,
  options?: { enabled?: boolean },
) => {
  return useQuery({
    ...orpc.integrations.listWhatsAppTemplates.queryOptions({
      input: { trackingId },
    }),
    enabled: options?.enabled ?? true,
    // Templates mudam raramente na WABA — evita refetch a cada foco.
    staleTime: 60_000,
  });
};

export const useCreateTemplateMessage = (conversationId: string) => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.message.createTemplate.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: ["message.list", conversationId],
        });
      },
    }),
  );
};
