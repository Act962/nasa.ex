// Motivo gravado em `PaymentDunningExecution.errorMessage` → frase para a tela. Os códigos
// vêm do disparo da régua, do envio pelo WhatsApp da org e do webhook de status da Meta.

const KNOWN_REASONS: Record<string, string> = {
  "contact-no-phone": "o cliente não tem telefone",
  "contact-no-email": "o cliente não tem e-mail",
  invalid_phone: "o telefone do cliente está incompleto",
  sender_tracking_not_connected: "o número escolhido para as cobranças está desconectado",
  no_connected_whatsapp_instance: "nenhum WhatsApp conectado",
  whatsapp_send_failed: "o WhatsApp recusou o envio",
  "customer-already-notified-today": "o cliente já recebeu um aviso hoje",
  "SMS not implemented": "SMS ainda não é enviado",
  "unknown-channel": "canal desconhecido",
  "email-error": "o serviço de e-mail recusou o envio",
  "meta-failed": "a Meta informou que não entregou",
};

// Códigos de erro da API oficial (developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes).
const META_ERROR_CODES: Record<string, string> = {
  "131026": "o número não tem WhatsApp ou não pode receber a mensagem",
  "131047": "fora da janela de 24h: o número oficial só envia modelo aprovado",
  "470": "fora da janela de 24h: o número oficial só envia modelo aprovado",
  "131049": "a Meta segurou a mensagem para não saturar o cliente",
  "131021": "o cliente é o próprio número que envia",
  "131050": "o cliente bloqueou mensagens de empresas",
  "131056": "muitas mensagens para o mesmo cliente em pouco tempo",
  "130429": "limite de envio da Meta atingido",
  "131042": "problema de pagamento na conta da Meta",
};

export function describeDunningFailure(reason: string | null | undefined): string {
  if (!reason) return "motivo não informado";
  const known = KNOWN_REASONS[reason];
  if (known) return known;

  const metaCode = reason.startsWith("meta-")
    ? reason.slice("meta-".length)
    : /\(#?(\d{3,6})\)/.exec(reason)?.[1];
  if (metaCode) {
    return META_ERROR_CODES[metaCode] ?? `a Meta recusou a mensagem (código ${metaCode})`;
  }
  return reason;
}
