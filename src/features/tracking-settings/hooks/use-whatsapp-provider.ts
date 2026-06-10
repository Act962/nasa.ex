import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

/**
 * Status real do número Meta (Fase 7.5). On-demand — chama
 * `GET /{waba_id}/phone_numbers` no servidor. Devolve `null` se a
 * instância não tem `provider=META_CLOUD` OU não tem WABA gravada.
 */
export const useMetaPhoneStatus = (trackingId: string, enabled = true) => {
  return useQuery({
    ...orpc.integrations.getMetaPhoneStatus.queryOptions({
      input: { trackingId },
    }),
    enabled,
  });
};

/**
 * Hooks Fase 4 — Roadmap WhatsApp Oficial.
 *
 * Consome `integrations.getProviderSettings` (lê provider + credenciais
 * Meta mascaradas) e `integrations.setProviderSettings` (grava provider
 * e/ou credenciais cifradas). Sem segredo em claro no client.
 */

export const useWhatsAppProviderSettings = (trackingId: string) => {
  return useQuery(
    orpc.integrations.getProviderSettings.queryOptions({
      input: { trackingId },
    }),
  );
};

export const useUpdateWhatsAppProviderSettings = (trackingId: string) => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.integrations.setProviderSettings.mutationOptions({
      onSuccess: ({ changed }) => {
        if (changed) {
          toast.success("Configuração de provider atualizada.");
        }
        queryClient.invalidateQueries({
          queryKey: orpc.integrations.getProviderSettings.queryKey({
            input: { trackingId },
          }),
        });
        // Invalida `get` também pra Badge de provider aparecer no shell.
        queryClient.invalidateQueries({
          queryKey: orpc.integrations.get.queryKey({
            input: { trackingId },
          }),
        });
      },
      onError: (error) => {
        toast.error(
          error instanceof Error
            ? `Erro: ${error.message}`
            : "Erro ao atualizar configuração de provider",
        );
      },
    }),
  );
};
