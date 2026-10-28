import "server-only";

import prisma from "@/lib/prisma";
import { getCustomerWindow } from "@/features/tracking-chat/lib/customer-window";
import {
  findOrganizationSenderInstance,
  sendOrganizationWhatsAppTemplate,
  sendOrganizationWhatsAppText,
} from "@/features/tracking-chat/lib/providers/send-org-document";
import { normalizePhoneToMetaE164 } from "@/features/tracking-chat/lib/providers/adapters/meta-cloud/normalize-phone";
import { getPaymentSenderTrackingId } from "./sender-tracking";

// Aviso da régua por WhatsApp (spec 0115, RF-13). Número não oficial: texto livre. Número
// oficial: texto livre com a janela de 24h aberta (sem custo, mais flexível) e o modelo
// aprovado do aviso com ela fechada — a Meta recusa texto livre fora da janela.

export type DunningWhatsAppTemplate = {
  name: string;
  language: string;
  /** Já interpoladas, na ordem dos {{1}}, {{2}}… do corpo do modelo. */
  bodyParameters: string[];
};

export type DunningWhatsAppResult =
  | { isSent: true; externalMessageId: string; via: "text" | "template" }
  | { isSent: false; reason: string };

/** O mesmo número aparece com e sem o 9º dígito (o `wa_id` antigo da Meta vem sem ele). */
function phoneCandidates(phone: string): string[] {
  const digits = phone.replace(/\D/g, "");
  const withNinth = normalizePhoneToMetaE164(digits.length <= 11 ? `55${digits}` : digits);
  const candidates = new Set([digits, withNinth]);
  if (withNinth.length === 13 && withNinth.startsWith("55")) {
    candidates.add(`${withNinth.slice(0, 4)}${withNinth.slice(5)}`);
  }
  return [...candidates];
}

async function isCustomerWindowOpen(trackingId: string, phone: string): Promise<boolean> {
  const conversation = await prisma.conversation.findFirst({
    where: { trackingId, channel: "WHATSAPP", lead: { phone: { in: phoneCandidates(phone) } } },
    orderBy: { lastMessageAt: "desc" },
    select: { id: true },
  });
  if (!conversation) return false;
  const window = await getCustomerWindow(conversation.id);
  return window.withinWindow;
}

export async function sendDunningWhatsApp(params: {
  organizationId: string;
  phone: string;
  text: string;
  template: DunningWhatsAppTemplate | null;
}): Promise<DunningWhatsAppResult> {
  const senderTrackingId = await getPaymentSenderTrackingId(params.organizationId);
  const sender = await findOrganizationSenderInstance(params.organizationId, senderTrackingId);

  const shouldUseTemplate =
    sender?.provider === "META_CLOUD" && !(await isCustomerWindowOpen(sender.trackingId, params.phone));

  if (!shouldUseTemplate) {
    const result = await sendOrganizationWhatsAppText({
      organizationId: params.organizationId,
      phone: params.phone,
      message: params.text,
      senderTrackingId,
    });
    return result.isSent ? { ...result, via: "text" } : result;
  }

  if (!params.template) return { isSent: false, reason: "meta_outside_window_without_template" };

  const result = await sendOrganizationWhatsAppTemplate({
    organizationId: params.organizationId,
    phone: params.phone,
    templateName: params.template.name,
    languageCode: params.template.language,
    bodyParameters: params.template.bodyParameters,
    senderTrackingId,
  });
  return result.isSent ? { ...result, via: "template" } : result;
}
