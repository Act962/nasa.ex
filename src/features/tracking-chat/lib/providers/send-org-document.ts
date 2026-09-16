import "server-only";
import prisma from "@/lib/prisma";
import { getPresignedReadUrl } from "@/lib/r2-url";
import { normalizePhoneToMetaE164 } from "./adapters/meta-cloud/normalize-phone";
import { resolveOutboundProvider } from "./index";

// Envio outbound "em nome da organização" (não de um atendimento): escolhe a
// instância CONNECTED mais antiga da org e fala pela PORT canônica, então
// funciona igual em Uazapi e Meta Cloud (spec 0017).

const PRESIGNED_URL_TTL_SECONDS = 900;

export type OrganizationWhatsAppSendResult =
  | { isSent: true; externalMessageId: string }
  | { isSent: false; reason: string };

export async function findConnectedOrganizationInstance(organizationId: string) {
  return prisma.whatsAppInstance.findFirst({
    where: { organizationId, status: "CONNECTED" },
    select: { id: true, trackingId: true, provider: true },
    orderBy: { createdAt: "asc" },
  });
}

function describeSendError(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 300);
  return "whatsapp_send_failed";
}

async function resolveOrganizationProvider(organizationId: string) {
  const instance = await findConnectedOrganizationInstance(organizationId);
  if (!instance) return null;
  return resolveOutboundProvider(instance.trackingId);
}

export async function sendOrganizationWhatsAppDocument(params: {
  organizationId: string;
  phone: string;
  fileKey: string;
  fileName: string;
  mimeType: string;
  caption?: string;
}): Promise<OrganizationWhatsAppSendResult> {
  const recipientPhone = normalizePhoneToMetaE164(params.phone);
  if (recipientPhone.length < 10) return { isSent: false, reason: "invalid_phone" };

  try {
    const resolved = await resolveOrganizationProvider(params.organizationId);
    if (!resolved) return { isSent: false, reason: "no_connected_whatsapp_instance" };

    const mediaUrl = await getPresignedReadUrl(params.fileKey, PRESIGNED_URL_TTL_SECONDS);
    const isImage = params.mimeType.startsWith("image/");
    const result = await resolved.provider.sendMedia({
      kind: "media",
      mediaKind: isImage ? "image" : "document",
      to: recipientPhone,
      mediaUrl,
      fileName: params.fileName,
      mimetype: params.mimeType,
      caption: params.caption,
      markPreviousAsRead: false,
    });
    return { isSent: true, externalMessageId: result.externalMessageId };
  } catch (error) {
    return { isSent: false, reason: describeSendError(error) };
  }
}

export async function sendOrganizationWhatsAppText(params: {
  organizationId: string;
  phone: string;
  message: string;
}): Promise<OrganizationWhatsAppSendResult> {
  const recipientPhone = normalizePhoneToMetaE164(params.phone);
  if (recipientPhone.length < 10) return { isSent: false, reason: "invalid_phone" };

  try {
    const resolved = await resolveOrganizationProvider(params.organizationId);
    if (!resolved) return { isSent: false, reason: "no_connected_whatsapp_instance" };

    const result = await resolved.provider.sendText({
      kind: "text",
      to: recipientPhone,
      body: params.message,
      markPreviousAsRead: false,
    });
    return { isSent: true, externalMessageId: result.externalMessageId };
  } catch (error) {
    return { isSent: false, reason: describeSendError(error) };
  }
}
