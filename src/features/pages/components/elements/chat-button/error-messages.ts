/**
 * Tradução dos códigos de erro do endpoint `/identify` para mensagens
 * amigáveis em pt-BR exibidas no banner do widget. Tabela pura (sem deps)
 * para manter o texto de UI separado da lógica de fetch.
 */

export const errorMessages: Record<string, string> = {
  invalid_body: "Erro inesperado. Recarregue a página.",
  invalid_input: "Verifique nome e número.",
  phone_too_short: "Número muito curto. Tente com DDD.",
  not_found:
    "Organização não encontrada. Avise o site que o chat está mal configurado.",
  no_tracking_available:
    "Sem atendimento disponível agora. Tente novamente em breve.",
  invalid_tracking: "Tracking inválido. Avise o site.",
  create_lead_failed: "Não consegui te cadastrar. Tente de novo.",
  needs_name: "Como podemos te chamar?",
};
