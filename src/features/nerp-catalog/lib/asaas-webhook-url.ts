import { nerpPublicOrigin } from "@/features/nerp/lib/oauth";

export function buildAsaasWebhookUrl(organizationId: string): string {
  return `${nerpPublicOrigin().replace(/\/$/, "")}/api/integrations/nerp/asaas-webhook/${organizationId}`;
}
