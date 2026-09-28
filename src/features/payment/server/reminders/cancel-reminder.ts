import "server-only";
import prisma from "@/lib/prisma";
import { inngest } from "@/inngest/client";
import { PAYMENT_REMINDER_EVENTS } from "./create-reminder";
import { PaymentReminderError } from "./errors";

// Cancela um lembrete ainda agendado (spec 0017, RF-5). O update condicional
// evita cancelar algo que o Inngest já está disparando; o evento derruba o
// sleep via `cancelOn`.

export async function cancelPaymentReminderRecord(params: {
  organizationId: string;
  reminderId: string;
}) {
  const { count } = await prisma.paymentReminder.updateMany({
    where: { id: params.reminderId, organizationId: params.organizationId, status: "SCHEDULED" },
    data: { status: "CANCELLED" },
  });

  if (count === 0) {
    const existing = await prisma.paymentReminder.findFirst({
      where: { id: params.reminderId, organizationId: params.organizationId },
      select: { status: true },
    });
    if (!existing) throw new PaymentReminderError("Lembrete não encontrado.");
    if (existing.status === "CANCELLED") return { reminderId: params.reminderId, wasAlreadyCancelled: true };
    throw new PaymentReminderError("Esse lembrete já foi processado e não pode mais ser cancelado.");
  }

  await inngest.send({
    name: PAYMENT_REMINDER_EVENTS.cancelled,
    data: { reminderId: params.reminderId, organizationId: params.organizationId },
  });

  return { reminderId: params.reminderId, wasAlreadyCancelled: false };
}
