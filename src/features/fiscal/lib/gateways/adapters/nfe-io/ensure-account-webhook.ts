// Registro (idempotente) do webhook de CONTA da NFE.io (/v2/webhooks) — vale
// para todas as empresas/organizações. A URI precisa responder 2xx no ping de
// criação, então localhost é pulado (dev converge via refreshStatus manual).

import {
  getNfeIoClient,
  getNfeIoWebhookSecret,
  extractNfeIoErrorInfo,
} from "@/lib/nfe-io";

const WEBHOOK_FILTERS = [
  "service_invoice.issued_successfully",
  "service_invoice.issued_failed",
  "service_invoice.cancelled_successfully",
  "service_invoice.cancelled_failed",
];

let ensuredInProcess = false;

export async function ensureNfeIoAccountWebhook(): Promise<void> {
  if (ensuredInProcess) return;

  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  if (!appBaseUrl || /localhost|127\.0\.0\.1/.test(appBaseUrl)) {
    console.warn(
      "[fiscal/nfe-io-gateway] webhook de conta não registrado — NEXT_PUBLIC_APP_URL ausente ou localhost (o ping da NFE.io exige URL pública).",
    );
    return;
  }

  const webhookUri = `${appBaseUrl}/api/nfe-io/webhook`;

  try {
    const nfeIo = getNfeIoClient();
    const existingWebhooks = await nfeIo.webhooks.listAccountWebhooks();
    const alreadyRegistered = (existingWebhooks.data ?? []).some(
      (webhook) => webhook.uri === webhookUri,
    );
    if (!alreadyRegistered) {
      await nfeIo.webhooks.createAccountWebhook({
        uri: webhookUri,
        contentType: "json",
        secret: getNfeIoWebhookSecret(),
        filters: WEBHOOK_FILTERS,
      });
    }
    ensuredInProcess = true;
  } catch (err) {
    // Falha aqui não pode bloquear o upsert do perfil — sem webhook o status
    // ainda converge via refreshStatus manual.
    console.error("[fiscal/nfe-io-gateway] falha ao garantir webhook de conta", {
      webhookUri,
      ...extractNfeIoErrorInfo(err),
    });
  }
}
