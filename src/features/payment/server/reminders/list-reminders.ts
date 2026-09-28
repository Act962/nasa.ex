import "server-only";
import prisma from "@/lib/prisma";
import {
  parseStoredDeliveryLog,
  parseStoredRecipients,
  type PaymentReminderStatusValue,
} from "@/features/payment/schemas/reminders";

const DEFAULT_LIST_LIMIT = 50;

export async function queryPaymentReminders(params: {
  organizationId: string;
  entryId?: string;
  status?: PaymentReminderStatusValue;
  limit?: number;
}) {
  const reminders = await prisma.paymentReminder.findMany({
    where: {
      organizationId: params.organizationId,
      ...(params.entryId ? { entryId: params.entryId } : {}),
      ...(params.status ? { status: params.status } : {}),
    },
    orderBy: [{ remindAt: "desc" }],
    take: params.limit ?? DEFAULT_LIST_LIMIT,
    include: {
      entry: {
        select: { id: true, description: true, amount: true, dueDate: true, status: true, type: true },
      },
      attachment: { select: { id: true, fileName: true, mimeType: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });

  return reminders.map((reminder) => ({
    id: reminder.id,
    entryId: reminder.entryId,
    attachmentId: reminder.attachmentId,
    remindAt: reminder.remindAt,
    channels: reminder.channels,
    recipients: parseStoredRecipients(reminder.recipients),
    message: reminder.message,
    notifyCreator: reminder.notifyCreator,
    status: reminder.status,
    sentAt: reminder.sentAt,
    deliveryLog: parseStoredDeliveryLog(reminder.deliveryLog),
    createdAt: reminder.createdAt,
    entry: reminder.entry,
    attachment: reminder.attachment,
    createdBy: reminder.createdBy,
  }));
}

export type PaymentReminderListItem = Awaited<ReturnType<typeof queryPaymentReminders>>[number];
