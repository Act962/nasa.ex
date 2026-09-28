import "server-only";
import prisma from "@/lib/prisma";
import { inngest } from "@/inngest/client";
import {
  REMINDER_MAX_RECIPIENTS,
  type PaymentReminderChannelValue,
  type ReminderRecipient,
} from "@/features/payment/schemas/reminders";
import { PaymentReminderError } from "./errors";

// Cria o lembrete e agenda o disparo (spec 0017, RF-2). O evento sai depois
// do insert — sem `$transaction` envolvendo I/O (regra 18).

const PAST_TOLERANCE_MS = 60_000;

export const PAYMENT_REMINDER_EVENTS = {
  created: "payment/reminder.created",
  cancelled: "payment/reminder.cancelled",
} as const;

export interface CreatePaymentReminderInput {
  organizationId: string;
  createdById: string;
  entryId?: string | null;
  attachmentId?: string | null;
  remindAt: Date;
  channels: PaymentReminderChannelValue[];
  recipients: ReminderRecipient[];
  message?: string | null;
  notifyCreator?: boolean;
}

function formatCentsBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function buildDefaultReminderMessage(
  entry: { description: string; amount: number; dueDate: Date } | null,
  organizationName: string,
): string {
  if (!entry) return `Olá! Segue o documento enviado por ${organizationName}.`;
  const dueDate = entry.dueDate.toLocaleDateString("pt-BR", { timeZone: "UTC" });
  return `Olá! Lembrete de ${organizationName}: "${entry.description}" no valor de ${formatCentsBRL(entry.amount)}, com vencimento em ${dueDate}. O documento segue anexo.`;
}

async function enrichRecipientsFromContacts(
  organizationId: string,
  recipients: ReminderRecipient[],
): Promise<ReminderRecipient[]> {
  const contactIds = recipients
    .map((recipient) => recipient.contactId)
    .filter((contactId): contactId is string => Boolean(contactId));
  if (contactIds.length === 0) return recipients;

  const contacts = await prisma.paymentContact.findMany({
    where: { id: { in: contactIds }, organizationId },
    select: { id: true, name: true, phone: true, email: true },
  });
  const contactsById = new Map(contacts.map((contact) => [contact.id, contact]));

  return recipients.map((recipient) => {
    if (!recipient.contactId) return recipient;
    const contact = contactsById.get(recipient.contactId);
    if (!contact) {
      throw new PaymentReminderError(`Contato "${recipient.name}" não pertence a esta organização.`);
    }
    return {
      contactId: contact.id,
      name: recipient.name || contact.name,
      phone: recipient.phone || contact.phone || undefined,
      email: recipient.email || contact.email || undefined,
    };
  });
}

export function assertRecipientsCoverChannels(
  recipients: ReminderRecipient[],
  channels: PaymentReminderChannelValue[],
) {
  const hasWhatsAppTarget = recipients.some((recipient) => Boolean(recipient.phone));
  const hasEmailTarget = recipients.some((recipient) => Boolean(recipient.email));
  const isAnyChannelReachable =
    (channels.includes("WHATSAPP") && hasWhatsAppTarget) ||
    (channels.includes("EMAIL") && hasEmailTarget);
  if (!isAnyChannelReachable) {
    throw new PaymentReminderError(
      "Nenhum destinatário tem telefone ou e-mail para os canais escolhidos.",
    );
  }
}

export async function createPaymentReminderRecord(input: CreatePaymentReminderInput) {
  const uniqueChannels = Array.from(new Set(input.channels));
  if (uniqueChannels.length === 0) throw new PaymentReminderError("Escolha ao menos um canal.");
  if (input.recipients.length === 0) throw new PaymentReminderError("Informe ao menos um destinatário.");
  if (input.recipients.length > REMINDER_MAX_RECIPIENTS) {
    throw new PaymentReminderError(`No máximo ${REMINDER_MAX_RECIPIENTS} destinatários por lembrete.`);
  }
  if (Number.isNaN(input.remindAt.getTime())) throw new PaymentReminderError("Data do lembrete inválida.");
  if (input.remindAt.getTime() < Date.now() - PAST_TOLERANCE_MS) {
    throw new PaymentReminderError("O horário do lembrete já passou.");
  }

  const attachment = input.attachmentId
    ? await prisma.paymentAttachment.findFirst({
        where: { id: input.attachmentId, organizationId: input.organizationId },
        select: { id: true, entryId: true },
      })
    : null;
  if (input.attachmentId && !attachment) {
    throw new PaymentReminderError("Documento não encontrado nesta organização.");
  }

  const entryId = input.entryId ?? attachment?.entryId ?? null;
  const entry = entryId
    ? await prisma.paymentEntry.findFirst({
        where: { id: entryId, organizationId: input.organizationId },
        select: { id: true, description: true, amount: true, dueDate: true, status: true },
      })
    : null;
  if (entryId && !entry) throw new PaymentReminderError("Lançamento não encontrado nesta organização.");
  if (entry && (entry.status === "PAID" || entry.status === "CANCELLED")) {
    throw new PaymentReminderError("Esse lançamento já está pago ou cancelado.");
  }

  const fallbackAttachment =
    !attachment && entry
      ? await prisma.paymentAttachment.findFirst({
          where: { organizationId: input.organizationId, entryId: entry.id },
          orderBy: { createdAt: "desc" },
          select: { id: true },
        })
      : null;

  const recipients = await enrichRecipientsFromContacts(input.organizationId, input.recipients);
  assertRecipientsCoverChannels(recipients, uniqueChannels);

  const organization = await prisma.organization.findUnique({
    where: { id: input.organizationId },
    select: { name: true },
  });
  const message =
    input.message?.trim() || buildDefaultReminderMessage(entry, organization?.name ?? "sua empresa");

  const reminder = await prisma.paymentReminder.create({
    data: {
      organizationId: input.organizationId,
      entryId: entry?.id ?? null,
      attachmentId: attachment?.id ?? fallbackAttachment?.id ?? null,
      remindAt: input.remindAt,
      channels: uniqueChannels,
      recipients: recipients as unknown as object,
      message,
      notifyCreator: input.notifyCreator ?? true,
      createdById: input.createdById,
    },
    select: { id: true, remindAt: true, attachmentId: true, entryId: true, message: true },
  });

  await inngest.send({
    id: `payment-reminder-created-${reminder.id}`,
    name: PAYMENT_REMINDER_EVENTS.created,
    data: { reminderId: reminder.id, organizationId: input.organizationId },
  });

  return { ...reminder, channels: uniqueChannels, recipients };
}
