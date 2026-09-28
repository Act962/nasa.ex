import "server-only";
import prisma from "@/lib/prisma";
import { resend } from "@/lib/email/resend";
import { chargeStarsByAction } from "@/features/stars/lib/charge-by-action";
import {
  findConnectedOrganizationInstance,
  sendOrganizationWhatsAppDocument,
  sendOrganizationWhatsAppText,
  type OrganizationWhatsAppSendResult,
} from "@/features/tracking-chat/lib/providers/send-org-document";
import { readAttachmentBytes } from "@/features/payment/server/documents/read-attachment-bytes";
import {
  parseStoredRecipients,
  type PaymentReminderChannelValue,
  type ReminderDeliveryLogItem,
  type ReminderRecipient,
} from "@/features/payment/schemas/reminders";
import { reactPaymentReminderEmail } from "./reminder-email";

// Disparo de um lembrete (spec 0017). Cada entrega é autocontida e nunca
// lança: o step do Inngest memoiza o resultado e um retry não cobra de novo.

export const REMINDER_STAR_ACTION = "astro_finance_reminder_send";

export interface ReminderDispatchSnapshot {
  reminderId: string;
  organizationId: string;
  organizationName: string;
  createdById: string;
  notifyCreator: boolean;
  channels: PaymentReminderChannelValue[];
  recipients: ReminderRecipient[];
  message: string;
  entry: { id: string; description: string; amountCents: number; dueDateIso: string } | null;
  attachment: { fileKey: string; fileName: string; mimeType: string } | null;
}

export type ReminderDispatchLoadResult =
  | { shouldSkip: true; reason: "not_found" | "not_scheduled" | "entry_settled"; snapshot: ReminderDispatchSnapshot | null }
  | { shouldSkip: false; snapshot: ReminderDispatchSnapshot };

export async function loadReminderForDispatch(reminderId: string): Promise<ReminderDispatchLoadResult> {
  const reminder = await prisma.paymentReminder.findUnique({
    where: { id: reminderId },
    include: {
      organization: { select: { name: true } },
      entry: { select: { id: true, description: true, amount: true, dueDate: true, status: true } },
      attachment: { select: { fileKey: true, fileName: true, mimeType: true } },
    },
  });
  if (!reminder) return { shouldSkip: true, reason: "not_found", snapshot: null };

  const snapshot: ReminderDispatchSnapshot = {
    reminderId: reminder.id,
    organizationId: reminder.organizationId,
    organizationName: reminder.organization.name,
    createdById: reminder.createdById,
    notifyCreator: reminder.notifyCreator,
    channels: reminder.channels,
    recipients: parseStoredRecipients(reminder.recipients),
    message: reminder.message,
    entry: reminder.entry
      ? {
          id: reminder.entry.id,
          description: reminder.entry.description,
          amountCents: reminder.entry.amount,
          dueDateIso: reminder.entry.dueDate.toISOString(),
        }
      : null,
    attachment: reminder.attachment,
  };

  if (reminder.status !== "SCHEDULED") return { shouldSkip: true, reason: "not_scheduled", snapshot };
  if (reminder.entry && (reminder.entry.status === "PAID" || reminder.entry.status === "CANCELLED")) {
    return { shouldSkip: true, reason: "entry_settled", snapshot };
  }
  return { shouldSkip: false, snapshot };
}

function buildDeliveryLog(params: {
  recipient: ReminderRecipient;
  channel: PaymentReminderChannelValue;
  status: ReminderDeliveryLogItem["status"];
  reason?: string | null;
  externalMessageId?: string | null;
  starsCharged?: number;
}): ReminderDeliveryLogItem {
  return {
    recipientName: params.recipient.name,
    channel: params.channel,
    status: params.status,
    reason: params.reason ?? null,
    externalMessageId: params.externalMessageId ?? null,
    starsCharged: params.starsCharged ?? 0,
    attemptedAt: new Date().toISOString(),
  };
}

async function chargeReminderDelivery(
  snapshot: ReminderDispatchSnapshot,
  recipient: ReminderRecipient,
  channel: PaymentReminderChannelValue,
): Promise<{ isCharged: boolean; starsCharged: number }> {
  const charge = await chargeStarsByAction(snapshot.organizationId, REMINDER_STAR_ACTION, {
    userId: snapshot.createdById,
    description: `Lembrete financeiro — ${channel === "WHATSAPP" ? "WhatsApp" : "e-mail"} para ${recipient.name}`,
  });
  if (!charge.success) return { isCharged: false, starsCharged: 0 };
  return { isCharged: true, starsCharged: charge.cost };
}

function formatCentsBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDueDate(dueDateIso: string): string {
  return new Date(dueDateIso).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

async function deliverByWhatsApp(
  snapshot: ReminderDispatchSnapshot,
  recipient: ReminderRecipient,
): Promise<ReminderDeliveryLogItem> {
  const channel = "WHATSAPP";
  if (!recipient.phone) return buildDeliveryLog({ recipient, channel, status: "SKIPPED", reason: "recipient_without_phone" });

  const instance = await findConnectedOrganizationInstance(snapshot.organizationId);
  if (!instance) {
    return buildDeliveryLog({ recipient, channel, status: "FAILED", reason: "no_connected_whatsapp_instance" });
  }

  const { isCharged, starsCharged } = await chargeReminderDelivery(snapshot, recipient, channel);
  if (!isCharged) return buildDeliveryLog({ recipient, channel, status: "FAILED", reason: "stars_insufficient" });

  const sendResult: OrganizationWhatsAppSendResult = snapshot.attachment
    ? await sendOrganizationWhatsAppDocument({
        organizationId: snapshot.organizationId,
        phone: recipient.phone,
        fileKey: snapshot.attachment.fileKey,
        fileName: snapshot.attachment.fileName,
        mimeType: snapshot.attachment.mimeType,
        caption: snapshot.message,
      })
    : await sendOrganizationWhatsAppText({
        organizationId: snapshot.organizationId,
        phone: recipient.phone,
        message: snapshot.message,
      });

  return sendResult.isSent
    ? buildDeliveryLog({ recipient, channel, status: "SENT", externalMessageId: sendResult.externalMessageId, starsCharged })
    : buildDeliveryLog({ recipient, channel, status: "FAILED", reason: sendResult.reason, starsCharged });
}

async function deliverByEmail(
  snapshot: ReminderDispatchSnapshot,
  recipient: ReminderRecipient,
): Promise<ReminderDeliveryLogItem> {
  const channel = "EMAIL";
  if (!recipient.email) return buildDeliveryLog({ recipient, channel, status: "SKIPPED", reason: "recipient_without_email" });

  let attachmentBytes: Uint8Array | null = null;
  if (snapshot.attachment) {
    attachmentBytes = await readAttachmentBytes(snapshot.attachment.fileKey).catch(() => null);
    if (!attachmentBytes) {
      return buildDeliveryLog({ recipient, channel, status: "FAILED", reason: "attachment_unavailable" });
    }
  }

  const { isCharged, starsCharged } = await chargeReminderDelivery(snapshot, recipient, channel);
  if (!isCharged) return buildDeliveryLog({ recipient, channel, status: "FAILED", reason: "stars_insufficient" });

  const subject = snapshot.entry
    ? `${snapshot.organizationName}: ${snapshot.entry.description} — vence ${formatDueDate(snapshot.entry.dueDateIso)}`
    : `Mensagem de ${snapshot.organizationName}`;

  try {
    const response = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? process.env.RESEND_FROM ?? "noreply@nasaagents.com",
      to: recipient.email,
      subject,
      react: reactPaymentReminderEmail({
        organizationName: snapshot.organizationName,
        recipientName: recipient.name,
        message: snapshot.message,
        entrySummary: snapshot.entry
          ? {
              description: snapshot.entry.description,
              amountLabel: formatCentsBRL(snapshot.entry.amountCents),
              dueDateLabel: formatDueDate(snapshot.entry.dueDateIso),
            }
          : null,
        attachmentFileName: snapshot.attachment?.fileName ?? null,
      }),
      attachments:
        snapshot.attachment && attachmentBytes
          ? [{ filename: snapshot.attachment.fileName, content: Buffer.from(attachmentBytes) }]
          : undefined,
    });
    if (response.error) {
      return buildDeliveryLog({ recipient, channel, status: "FAILED", reason: response.error.message ?? "email_error", starsCharged });
    }
    return buildDeliveryLog({ recipient, channel, status: "SENT", externalMessageId: response.data?.id ?? null, starsCharged });
  } catch (error) {
    const reason = error instanceof Error ? error.message.slice(0, 300) : "email_error";
    return buildDeliveryLog({ recipient, channel, status: "FAILED", reason, starsCharged });
  }
}

export async function deliverReminderToRecipient(params: {
  snapshot: ReminderDispatchSnapshot;
  recipient: ReminderRecipient;
  channel: PaymentReminderChannelValue;
}): Promise<ReminderDeliveryLogItem> {
  try {
    return params.channel === "WHATSAPP"
      ? await deliverByWhatsApp(params.snapshot, params.recipient)
      : await deliverByEmail(params.snapshot, params.recipient);
  } catch (error) {
    const reason = error instanceof Error ? error.message.slice(0, 300) : "delivery_error";
    return buildDeliveryLog({ recipient: params.recipient, channel: params.channel, status: "FAILED", reason });
  }
}
