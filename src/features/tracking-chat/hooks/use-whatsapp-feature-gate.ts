import { useWhatsAppProviderSettings } from "@/features/tracking-settings/hooks/use-whatsapp-provider";

/**
 * Gate de features Meta-unsupported no chat (followup #10).
 *
 * A Meta Cloud API não tem endpoint pra editar/apagar mensagem outbound
 * nem pra botões interativos ad-hoc (exigem template HSM). O backend já
 * recusa com `META_FEATURE_UNSUPPORTED`, mas o ideal é desabilitar a ação
 * ANTES do clique — sem toast de erro. Este hook centraliza a decisão pra
 * `message-box` (editar/apagar) e `footer-chat` (botões).
 *
 * A query é deduplicada pelo TanStack por `trackingId`, então chamar em
 * cada `MessageBox` da lista dispara UMA requisição só.
 */
export function useWhatsAppFeatureGate(trackingId?: string) {
  const settings = useWhatsAppProviderSettings(trackingId ?? "", {
    enabled: !!trackingId,
  });

  const isMeta = settings.data?.provider === "META_CLOUD";

  return {
    isMeta,
    canEditMessage: !isMeta,
    canDeleteMessage: !isMeta,
    canUseInteractiveButtons: !isMeta,
    unsupportedReason: "Indisponível na API Oficial (Meta Cloud).",
  };
}
