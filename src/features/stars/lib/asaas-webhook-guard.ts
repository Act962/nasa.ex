// Decisões do webhook Asaas de recarga de Stars: quem chamou é o Asaas, e o
// valor pago cobre o pacote. Puro, para ser testado sem banco.

import { isSecretTokenValid } from "@/lib/security/webhook-auth";

const VALUE_TOLERANCE_BRL = 0.01;

/**
 * O Asaas manda no header `asaas-access-token` o token cadastrado no webhook.
 * Vale o `webhookSecret` de qualquer gateway Asaas ativo; sem nenhum
 * configurado, recusa tudo (o handler credita Stars).
 */
export function isAsaasStarsWebhookAuthorized(
  receivedToken: string | null,
  gatewayWebhookSecrets: readonly (string | null)[],
): boolean {
  return gatewayWebhookSecrets.some((webhookSecret) =>
    isSecretTokenValid(receivedToken, webhookSecret),
  );
}

/** Pagar a mais credita; pagar a menos, não. */
export function isPaidValueSufficient(paidValue: unknown, expectedBrl: number): boolean {
  if (typeof paidValue !== "number" || !Number.isFinite(paidValue)) return false;
  return paidValue + VALUE_TOLERANCE_BRL >= expectedBrl;
}
