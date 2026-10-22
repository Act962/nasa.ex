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
  // Número de QR code primeiro (UAZAPI vem antes de META_CLOUD no enum): o oficial recusa mensagem livre fora da
  // janela de 24h, e lembretes e avisos daqui são mensagem livre.
  return prisma.whatsAppInstance.findFirst({
    where: { organizationId, status: "CONNECTED" },
    select: { id: true, trackingId: true, provider: true },
    orderBy: [{ provider: "asc" }, { createdAt: "asc" }],
  });
}

function describeSendError(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 300);
  return "whatsapp_send_failed";
}

/** Com `senderTrackingId`, só o número daquele tracking: sem trocar sozinho para outro número da org. */
export async function findOrganizationSenderInstance(organizationId: string, senderTrackingId?: string | null) {
  if (!senderTrackingId) return findConnectedOrganizationInstance(organizationId);
  return prisma.whatsAppInstance.findFirst({
    where: { organizationId, trackingId: senderTrackingId, status: "CONNECTED" },
    select: { id: true, trackingId: true, provider: true },
  });
}

async function resolveOrganizationProvider(organizationId: string, senderTrackingId?: string | null) {
  const instance = await findOrganizationSenderInstance(organizationId, senderTrackingId);
  if (!instance) return null;
  return resolveOutboundProvider(instance.trackingId);
}

function describeMissingInstance(senderTrackingId?: string | null): string {
  return senderTrackingId ? "sender_tracking_not_connected" : "no_connected_whatsapp_instance";
}

export async function sendOrganizationWhatsAppDocument(params: {
  organizationId: string;
  phone: string;
  fileKey: string;
  fileName: string;
  mimeType: string;
  caption?: string;
  senderTrackingId?: string | null;
}): Promise<OrganizationWhatsAppSendResult> {
  const recipientPhone = normalizePhoneToMetaE164(params.phone);
  if (recipientPhone.length < 10) return { isSent: false, reason: "invalid_phone" };

  try {
    const resolved = await resolveOrganizationProvider(params.organizationId, params.senderTrackingId);
    if (!resolved) return { isSent: false, reason: describeMissingInstance(params.senderTrackingId) };

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
  senderTrackingId?: string | null;
}): Promise<OrganizationWhatsAppSendResult> {
  const recipientPhone = normalizePhoneToMetaE164(params.phone);
  if (recipientPhone.length < 10) return { isSent: false, reason: "invalid_phone" };

  try {
    const resolved = await resolveOrganizationProvider(params.organizationId, params.senderTrackingId);
    if (!resolved) return { isSent: false, reason: describeMissingInstance(params.senderTrackingId) };

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
