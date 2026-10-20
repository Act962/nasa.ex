// Decide o que fazer com um POST de webhook da Meta (Messenger e Instagram
// pelas conexões antigas) a partir da assinatura `x-hub-signature-256`.

import { isMetaSignatureValid } from "@/http/whats-oficial/verify-signature";
import { resolveWebhookAuthMode, type WebhookAuthMode } from "./webhook-auth";

export type MetaWebhookSignatureCheck = {
  isSignatureValid: boolean;
  authMode: WebhookAuthMode;
  shouldReject: boolean;
};

/**
 * O padrão destas rotas é `log-only`, não `enforce`: a conexão manual antiga
 * deixa o cliente apontar o próprio app da Meta para cá, e esse app assina com
 * um segredo que a plataforma não tem. Bloquear por padrão derrubaria as
 * mensagens desses clientes. `META_MESSAGING_WEBHOOK_AUTH_MODE=enforce` liga o
 * bloqueio depois de conferir, pelo log, que nenhuma conexão ativa depende disso.
 */
export function checkMetaWebhookSignature(input: {
  rawBody: string;
  signatureHeader: string | null;
  appSecret: string | undefined;
  configuredMode: string | undefined;
}): MetaWebhookSignatureCheck {
  const isSignatureValid = isMetaSignatureValid(
    input.rawBody,
    input.signatureHeader,
    input.appSecret ?? "",
  );
  const authMode = resolveWebhookAuthMode(input.configuredMode, "log-only");
  return {
    isSignatureValid,
    authMode,
    shouldReject: !isSignatureValid && authMode === "enforce",
  };
}
