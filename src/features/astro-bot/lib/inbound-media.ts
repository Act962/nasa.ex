// Documento/imagem que um membro allow-listado manda pro Astro pelo WhatsApp
// (spec 0019): baixa do provider da tracking e guarda como PaymentAttachment
// sem vínculo, pronto pro `read_financial_document`.
import "server-only";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";
import type { UserWhatsappBinding } from "@/generated/prisma/client";
import prisma from "@/lib/prisma";
import { S3 } from "@/lib/s3-client";
import { downloadFile } from "@/http/uazapi/get-file";
import { downloadInboundMedia } from "@/http/whats-oficial/get-media";
import { resolveOutboundProvider } from "@/features/tracking-chat/lib/providers/resolve-outbound-provider";
import { decryptStoredMetaCredentialsPartial } from "@/features/tracking-chat/lib/providers/meta-credentials";
import {
  isPaymentActionAllowed,
  resolvePaymentPermissions,
} from "@/features/payment/server/access/resolve-payment-permissions";
import {
  MAX_ATTACHMENT_BYTES,
  formatFileSize,
  guessAttachmentKind,
} from "@/features/payment/lib/attachments";
import type { AstroAttachmentRef } from "@/features/astro/server/agents/types";
import type { BotInboundMedia } from "./types";

const DOWNLOAD_TIMEOUT_MS = 15_000;

const EXTENSION_BY_MIMETYPE: Record<string, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

export type BotMediaRejectionStatus = "media_unsupported" | "media_forbidden" | "media_failed";

export type BotMediaAssessment =
  | { isEligible: true; mimeType: string }
  | { isEligible: false; status: BotMediaRejectionStatus; reply: string };

export type StoreBotInboundDocumentResult =
  | { isStored: true; attachment: AstroAttachmentRef }
  | { isStored: false; status: BotMediaRejectionStatus; reply: string };

const UNSUPPORTED_REPLY =
  "📎 Por aqui eu só leio *PDF* ou *foto* de boleto, nota fiscal, recibo ou extrato. Manda nesse formato que eu dou uma olhada.";
const FORBIDDEN_REPLY =
  "🔒 Seu usuário não tem permissão pra lançar no financeiro desta empresa. Peça ao admin acesso de criação em Lançamentos no ÓRBITA Payment.";
const FAILED_REPLY =
  "❌ Não consegui baixar esse arquivo do WhatsApp. Tenta mandar de novo daqui a pouco.";

function resolveDeclaredMimetype(media: BotInboundMedia): string | null {
  const declared = media.mimetype?.split(";")[0]?.trim().toLowerCase();
  if (declared && EXTENSION_BY_MIMETYPE[declared]) return declared;
  if (media.fileName?.toLowerCase().endsWith(".pdf")) return "application/pdf";
  if (!declared && media.kind === "image") return "image/jpeg";
  return null;
}

export async function assessBotInboundMedia(
  binding: UserWhatsappBinding,
  media: BotInboundMedia,
): Promise<BotMediaAssessment> {
  const mimeType = resolveDeclaredMimetype(media);
  if (!mimeType) {
    return { isEligible: false, status: "media_unsupported", reply: UNSUPPORTED_REPLY };
  }

  const user = await prisma.user.findUnique({
    where: { id: binding.userId },
    select: { id: true, name: true, email: true, image: true },
  });
  const permissions = user
    ? await resolvePaymentPermissions(user, binding.organizationId)
    : null;
  if (!isPaymentActionAllowed(permissions, "entries", "create")) {
    return { isEligible: false, status: "media_forbidden", reply: FORBIDDEN_REPLY };
  }

  return { isEligible: true, mimeType };
}

async function downloadFromTrackingProvider(
  trackingId: string,
  media: BotInboundMedia,
): Promise<Buffer | null> {
  const resolved = await resolveOutboundProvider(trackingId);

  if (resolved.providerId === "uazapi") {
    if (!resolved.uazapiToken) return null;
    const downloaded = await downloadFile({
      token: resolved.uazapiToken,
      baseUrl: resolved.uazapiBaseUrl,
      data: { id: media.externalMessageId, return_base64: false },
    });
    if (!downloaded?.fileURL) return null;
    const response = await fetch(downloaded.fileURL, {
      signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    return Buffer.from(await response.arrayBuffer());
  }

  if (!media.mediaId) return null;
  const instance = await prisma.whatsAppInstance.findUnique({
    where: { trackingId },
    select: {
      metaAccessToken: true,
      metaPhoneNumberId: true,
      metaAppSecret: true,
      metaVerifyToken: true,
      metaBusinessAccountId: true,
    },
  });
  if (!instance) return null;
  const credentials = decryptStoredMetaCredentialsPartial(instance);
  const downloaded = await downloadInboundMedia(credentials.accessToken, media.mediaId);
  return downloaded.buffer.length > 0 ? downloaded.buffer : null;
}

function buildFallbackFileName(media: BotInboundMedia, extension: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const label = media.kind === "image" ? "foto" : "documento";
  return `whatsapp-${label}-${today}.${extension}`;
}

export async function storeBotInboundDocument(params: {
  binding: UserWhatsappBinding;
  trackingId: string;
  media: BotInboundMedia;
}): Promise<StoreBotInboundDocumentResult> {
  const { binding, trackingId, media } = params;

  const assessment = await assessBotInboundMedia(binding, media);
  if (!assessment.isEligible) {
    return { isStored: false, status: assessment.status, reply: assessment.reply };
  }

  const bucketName = process.env.NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES;
  if (!bucketName) {
    console.error("[astro-bot/inbound-media] missing_bucket_env");
    return { isStored: false, status: "media_failed", reply: FAILED_REPLY };
  }

  let fileBuffer: Buffer | null = null;
  try {
    fileBuffer = await downloadFromTrackingProvider(trackingId, media);
  } catch (downloadError) {
    console.error("[astro-bot/inbound-media] download_failed", {
      bindingId: binding.id,
      externalMessageId: media.externalMessageId,
      downloadError,
    });
  }
  if (!fileBuffer) {
    return { isStored: false, status: "media_failed", reply: FAILED_REPLY };
  }

  if (fileBuffer.length > MAX_ATTACHMENT_BYTES) {
    return {
      isStored: false,
      status: "media_unsupported",
      reply: `📎 Esse arquivo tem ${formatFileSize(fileBuffer.length)} — o limite é ${formatFileSize(MAX_ATTACHMENT_BYTES)}. Manda uma versão menor.`,
    };
  }

  const extension = EXTENSION_BY_MIMETYPE[assessment.mimeType] ?? "bin";
  const fileName = media.fileName?.trim() || buildFallbackFileName(media, extension);
  const fileKey = `payment/attachments/${binding.organizationId}/${uuidv4()}.${extension}`;

  await S3.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: fileKey,
      Body: fileBuffer,
      ContentType: assessment.mimeType,
    }),
  );

  const attachment = await prisma.paymentAttachment.create({
    data: {
      organizationId: binding.organizationId,
      fileKey,
      fileName,
      originalFileName: fileName,
      mimeType: assessment.mimeType,
      sizeBytes: fileBuffer.length,
      kind: guessAttachmentKind(fileName),
      sourceChannel: "whatsapp",
      uploadedById: binding.userId,
    },
    select: { id: true, fileName: true, mimeType: true, sizeBytes: true },
  });

  return {
    isStored: true,
    attachment: {
      attachmentId: attachment.id,
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
    },
  };
}
