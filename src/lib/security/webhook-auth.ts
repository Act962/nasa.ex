// Peças comuns de autenticação de webhook: comparação de segredo em tempo
// constante e o modo de aplicação (bloquear ou só registrar) de cada rota.

import { createHash, timingSafeEqual } from "node:crypto";

export type WebhookAuthMode = "enforce" | "log-only";

const WEBHOOK_AUTH_MODES: readonly WebhookAuthMode[] = ["enforce", "log-only"];

function sha256(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

/**
 * Fail-closed: sem segredo configurado ou sem token recebido, recusa.
 * Comparar os hashes (tamanho fixo) evita vazar o tamanho do segredo.
 */
export function isSecretTokenValid(
  receivedToken: string | null | undefined,
  expectedToken: string | null | undefined,
): boolean {
  if (!receivedToken || !expectedToken) return false;
  return timingSafeEqual(sha256(receivedToken), sha256(expectedToken));
}

/**
 * `log-only` existe para a implantação: registra o que seria recusado sem
 * recusar, até confirmar que o segredo está configurado nos dois lados.
 * Valor ausente ou desconhecido cai no padrão da rota.
 */
export function resolveWebhookAuthMode(
  configuredMode: string | undefined,
  defaultMode: WebhookAuthMode,
): WebhookAuthMode {
  const normalizedMode = configuredMode?.trim().toLowerCase();
  return WEBHOOK_AUTH_MODES.find((mode) => mode === normalizedMode) ?? defaultMode;
}
