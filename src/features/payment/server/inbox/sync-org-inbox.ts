import "server-only";

import prisma from "@/lib/prisma";
import { resolveGoogleAccessToken } from "@/features/integrations/lib/oauth/resolve-google-access-token";
import { listGmailMessages } from "@/http/gmail/list-messages";
import { getGmailMessage, type GmailMessageAttachment } from "@/http/gmail/get-message";
import { MAX_ATTACHMENT_BYTES } from "@/features/payment/lib/attachments";
import {
  GMAIL_PART_KEY_PREFIX,
  GMAIL_READONLY_SCOPE,
  MAX_INGESTIONS_PER_SYNC,
  MAX_MESSAGES_PER_SYNC,
  MIN_IMAGE_ATTACHMENT_BYTES,
} from "./inbox-constants";
import { notifyInboxFindings } from "./notify-inbox-findings";

// Sincronização de uma org (spec 0018): descobre anexos novos na caixa Gmail
// de quem conectou a integração, grava `PaymentInboxItem` NEW e devolve os ids
// que a função Inngest ingere um a um. A ingestão mora em ingest-inbox-attachment.

export type DiscoverOrgInboxResult =
  | { ok: true; itemIds: string[]; accountEmail: string | null; discoveredCount: number }
  | { ok: false; reason: "disabled" | "token_unavailable" | "gmail_failed"; message: string };

type AttachmentEligibility = "eligible" | "too_large" | "unsupported";

function classifyAttachment(attachment: GmailMessageAttachment): AttachmentEligibility {
  const lowerFileName = attachment.fileName.toLowerCase();
  const isPdf = attachment.mimeType.includes("pdf") || lowerFileName.endsWith(".pdf");
  const isImage = /^image\/(png|jpe?g|webp)$/.test(attachment.mimeType);
  if (!isPdf && !(isImage && attachment.sizeBytes >= MIN_IMAGE_ATTACHMENT_BYTES)) {
    return "unsupported";
  }
  if (attachment.sizeBytes > MAX_ATTACHMENT_BYTES) return "too_large";
  return "eligible";
}

async function recordSyncError(organizationId: string, message: string) {
  await prisma.paymentInboxConfig.update({
    where: { organizationId },
    data: { lastError: message.slice(0, 500) },
  });
}

export async function discoverOrgInboxItems(params: {
  organizationId: string;
}): Promise<DiscoverOrgInboxResult> {
  const config = await prisma.paymentInboxConfig.findUnique({
    where: { organizationId: params.organizationId },
    select: { isEnabled: true, gmailQuery: true },
  });
  if (!config?.isEnabled) {
    return { ok: false, reason: "disabled", message: "Caixa de entrada desativada" };
  }

  // Sem retry aqui de propósito: token recusado não se conserta tentando de
  // novo, e o erro fica visível na tela até alguém reconectar (CA-6).
  const token = await resolveGoogleAccessToken({
    organizationId: params.organizationId,
    requiredScope: GMAIL_READONLY_SCOPE,
  });
  if (!token.ok) {
    await recordSyncError(params.organizationId, token.message);
    return { ok: false, reason: "token_unavailable", message: token.message };
  }

  let discoveredCount = 0;
  try {
    const messageRefs = await listGmailMessages({
      accessToken: token.accessToken,
      query: config.gmailQuery,
      maxResults: MAX_MESSAGES_PER_SYNC,
    });

    const knownMessages = await prisma.paymentInboxItem.findMany({
      where: {
        organizationId: params.organizationId,
        gmailMessageId: { in: messageRefs.map((messageRef) => messageRef.id) },
      },
      select: { gmailMessageId: true },
      distinct: ["gmailMessageId"],
    });
    const knownMessageIds = new Set(knownMessages.map((known) => known.gmailMessageId));

    for (const messageRef of messageRefs) {
      if (knownMessageIds.has(messageRef.id)) continue;
      const message = await getGmailMessage({
        accessToken: token.accessToken,
        messageId: messageRef.id,
      });

      const rows = message.attachments
        .map((attachment) => ({ attachment, eligibility: classifyAttachment(attachment) }))
        .filter(({ eligibility }) => eligibility !== "unsupported")
        .map(({ attachment, eligibility }) => ({
          organizationId: params.organizationId,
          gmailMessageId: message.id,
          gmailAttachmentId: `${GMAIL_PART_KEY_PREFIX}${attachment.partId}`,
          threadId: message.threadId,
          subject: message.subject.slice(0, 500),
          fromEmail: message.fromEmail,
          fromName: message.fromName,
          receivedAt: message.receivedAt,
          status: eligibility === "too_large" ? ("FAILED" as const) : ("NEW" as const),
          errorMessage:
            eligibility === "too_large" ? `${attachment.fileName}: arquivo acima do limite de 16 MB` : null,
        }));
      if (rows.length === 0) continue;

      const created = await prisma.paymentInboxItem.createMany({ data: rows, skipDuplicates: true });
      discoveredCount += created.count;
    }
  } catch (error) {
    const message = `Falha ao ler o Gmail: ${error instanceof Error ? error.message : String(error)}`;
    await recordSyncError(params.organizationId, message);
    return { ok: false, reason: "gmail_failed", message };
  }

  const pendingItems = await prisma.paymentInboxItem.findMany({
    where: { organizationId: params.organizationId, status: "NEW" },
    select: { id: true },
    orderBy: { receivedAt: "desc" },
    take: MAX_INGESTIONS_PER_SYNC,
  });

  return {
    ok: true,
    itemIds: pendingItems.map((item) => item.id),
    accountEmail: token.accountEmail,
    discoveredCount,
  };
}

export async function finishOrgInboxSync(params: {
  organizationId: string;
  processedItemIds: string[];
  accountEmail: string | null;
}): Promise<{ proposedCount: number; notified: number }> {
  await prisma.paymentInboxConfig.update({
    where: { organizationId: params.organizationId },
    data: { lastSyncAt: new Date(), lastError: null },
  });

  const proposedCount = params.processedItemIds.length
    ? await prisma.paymentInboxItem.count({
        where: {
          organizationId: params.organizationId,
          id: { in: params.processedItemIds },
          status: "PROPOSED",
        },
      })
    : 0;

  if (proposedCount === 0) return { proposedCount, notified: 0 };

  const { notified } = await notifyInboxFindings({
    organizationId: params.organizationId,
    proposedCount,
    accountEmail: params.accountEmail,
  });
  return { proposedCount, notified };
}
