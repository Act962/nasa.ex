import "server-only";
import { InterApiError, interRequest } from "./client";
import type { InterCallContext, InterWebhookConfig } from "./types";

// Webhook de PIX Cobrança, um por chave PIX. O Inter acrescenta `/pix` à URL cadastrada
// e tenta de novo até 4 vezes (20, 30, 60 e 120 min) quando não recebe 2xx.

/** Na rota do webhook a chave telefone vai sem o "+" (na cobrança ela vai com). */
function webhookPath(pixKey: string): string {
  return `/pix/v2/webhook/${encodeURIComponent(pixKey.replace(/^\+/, ""))}`;
}

/** Escopo `webhook.write`. */
export async function registerInterPixWebhook(
  context: InterCallContext,
  pixKey: string,
  webhookUrl: string,
): Promise<void> {
  if (!webhookUrl.startsWith("https://")) throw new Error("O Inter só aceita webhook em https://.");
  await interRequest(context, { method: "PUT", path: webhookPath(pixKey), body: { webhookUrl } });
}

/** Escopo `webhook.read`. `null` quando a chave não tem webhook. */
export async function getInterPixWebhook(
  context: InterCallContext,
  pixKey: string,
): Promise<InterWebhookConfig | null> {
  try {
    return await interRequest<InterWebhookConfig>(context, { method: "GET", path: webhookPath(pixKey) });
  } catch (error) {
    if (error instanceof InterApiError && error.status === 404) return null;
    throw error;
  }
}

/** Escopo `webhook.write`. Já removido conta como sucesso. */
export async function deleteInterPixWebhook(context: InterCallContext, pixKey: string): Promise<void> {
  try {
    await interRequest(context, { method: "DELETE", path: webhookPath(pixKey) });
  } catch (error) {
    if (error instanceof InterApiError && error.status === 404) return;
    throw error;
  }
}
