import "server-only";

import { resolveOutboundProvider } from "@/features/tracking-chat/lib/providers/resolve-outbound-provider";
import { findConnectedOrganizationInstance } from "@/features/tracking-chat/lib/providers/send-org-document";
import { normalizePhoneToMetaE164 } from "@/features/tracking-chat/lib/providers/adapters/meta-cloud/normalize-phone";

// Aviso fiscal pelo WhatsApp da própria empresa (instância conectada mais
// antiga). Meta Cloud fora da janela de 24h só aceita template aprovado: com
// ACCOUNTING_ALERT_WHATSAPP_TEMPLATE configurado ele é usado sempre; sem ele,
// tentamos texto e registramos o motivo quando a Meta recusa. Nunca lança.

const TEMPLATE_LANGUAGE = "pt_BR";

export interface ComplianceWhatsAppMessage {
  /** Texto completo (Uazapi, ou Meta dentro da janela de 24h). */
  text: string;
  /** Parâmetros do template, na ordem: o que vence, quando, valor, link. */
  templateParameters: [string, string, string, string];
}

export type ComplianceWhatsAppResult =
  | { phone: string; isSent: true; via: "template" | "text" }
  | { phone: string; isSent: false; reason: string };

function describeError(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 300) : "whatsapp_send_failed";
}

export async function sendComplianceWhatsApp(params: {
  organizationId: string;
  phones: string[];
  message: ComplianceWhatsAppMessage;
}): Promise<ComplianceWhatsAppResult[]> {
  const phones = [...new Set(params.phones.map((phone) => phone.trim()).filter(Boolean))];
  if (phones.length === 0) return [];

  const instance = await findConnectedOrganizationInstance(params.organizationId).catch(() => null);
  if (!instance) {
    return phones.map((phone) => ({ phone, isSent: false, reason: "no_connected_whatsapp_instance" }));
  }

  let resolved: Awaited<ReturnType<typeof resolveOutboundProvider>>;
  try {
    resolved = await resolveOutboundProvider(instance.trackingId);
  } catch (error) {
    const reason = `no_provider: ${describeError(error)}`;
    return phones.map((phone) => ({ phone, isSent: false, reason }));
  }

  const templateName = process.env.ACCOUNTING_ALERT_WHATSAPP_TEMPLATE?.trim() || null;
  const shouldUseTemplate = resolved.providerId === "meta-cloud" && templateName !== null;

  const results: ComplianceWhatsAppResult[] = [];
  for (const phone of phones) {
    const recipientPhone = normalizePhoneToMetaE164(phone);
    if (recipientPhone.length < 10) {
      results.push({ phone, isSent: false, reason: "invalid_phone" });
      continue;
    }
    try {
      if (shouldUseTemplate && templateName) {
        await resolved.provider.sendTemplate({
          kind: "template",
          to: recipientPhone,
          templateName,
          languageCode: TEMPLATE_LANGUAGE,
          bodyParameters: params.message.templateParameters,
        });
        results.push({ phone, isSent: true, via: "template" });
        continue;
      }
      await resolved.provider.sendText({
        kind: "text",
        to: recipientPhone,
        body: params.message.text,
        previewUrl: true,
        markPreviousAsRead: false,
      });
      results.push({ phone, isSent: true, via: "text" });
    } catch (error) {
      const reason =
        resolved.providerId === "meta-cloud" && !templateName
          ? `meta_outside_24h_window_without_template: ${describeError(error)}`
          : describeError(error);
      results.push({ phone, isSent: false, reason });
    }
  }
  return results;
}
