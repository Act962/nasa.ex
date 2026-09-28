import { z } from "zod";

// Contratos compartilhados dos lembretes com envio de documento (spec 0017).

export const PAYMENT_REMINDER_CHANNELS = ["WHATSAPP", "EMAIL"] as const;
export type PaymentReminderChannelValue = (typeof PAYMENT_REMINDER_CHANNELS)[number];

export const PAYMENT_REMINDER_STATUSES = [
  "SCHEDULED",
  "SENT",
  "PARTIAL",
  "FAILED",
  "SKIPPED",
  "CANCELLED",
] as const;
export type PaymentReminderStatusValue = (typeof PAYMENT_REMINDER_STATUSES)[number];

export const REMINDER_MESSAGE_MAX_LENGTH = 1000;
export const REMINDER_MAX_RECIPIENTS = 10;

export const reminderRecipientSchema = z.object({
  contactId: z.string().optional(),
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(30).optional(),
  email: z.string().trim().email().max(200).optional(),
});
export type ReminderRecipient = z.infer<typeof reminderRecipientSchema>;

export const reminderDeliveryStatusSchema = z.enum(["SENT", "FAILED", "SKIPPED"]);

export const reminderDeliveryLogItemSchema = z.object({
  recipientName: z.string(),
  channel: z.enum(PAYMENT_REMINDER_CHANNELS),
  status: reminderDeliveryStatusSchema,
  reason: z.string().nullable(),
  externalMessageId: z.string().nullable(),
  starsCharged: z.number(),
  attemptedAt: z.string(),
});
export type ReminderDeliveryLogItem = z.infer<typeof reminderDeliveryLogItemSchema>;

export function parseStoredRecipients(value: unknown): ReminderRecipient[] {
  const parsed = z.array(reminderRecipientSchema).safeParse(value);
  return parsed.success ? parsed.data : [];
}

export function parseStoredDeliveryLog(value: unknown): ReminderDeliveryLogItem[] {
  const parsed = z.array(reminderDeliveryLogItemSchema).safeParse(value);
  return parsed.success ? parsed.data : [];
}

export const REMINDER_STATUS_LABELS: Record<PaymentReminderStatusValue, string> = {
  SCHEDULED: "Agendado",
  SENT: "Enviado",
  PARTIAL: "Parcial",
  FAILED: "Falhou",
  SKIPPED: "Não enviado",
  CANCELLED: "Cancelado",
};

export const REMINDER_CHANNEL_LABELS: Record<PaymentReminderChannelValue, string> = {
  WHATSAPP: "WhatsApp",
  EMAIL: "E-mail",
};
