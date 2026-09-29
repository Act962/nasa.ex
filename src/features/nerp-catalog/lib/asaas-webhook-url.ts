import { nerpPublicOrigin } from "@/features/nerp/lib/oauth";

// ASAAS_WEBHOOK_PUBLIC_ORIGIN é lida em tempo de execução (não é inlinada no build):
// permite apontar o webhook para um túnel (ngrok) sem mexer na URL pública do app.
function resolveWebhookOrigin(): string {
  return process.env.ASAAS_WEBHOOK_PUBLIC_ORIGIN || nerpPublicOrigin();
}

export function buildAsaasWebhookUrl(organizationId: string): string {
  return `${resolveWebhookOrigin().replace(/\/$/, "")}/api/integrations/nerp/asaas-webhook/${organizationId}`;
}
