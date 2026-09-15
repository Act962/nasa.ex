import "server-only";
import prisma from "@/lib/prisma";
import { createNotification } from "@/features/admin/lib/notification-service";
import type {
  PaymentReminderStatusValue,
  ReminderDeliveryLogItem,
} from "@/features/payment/schemas/reminders";
import type { ReminderDispatchSnapshot } from "./dispatch-reminder";

// Fecha o ciclo do lembrete: status agregado, log de entregas e aviso ao
// criador (spec 0017, RF-6/CA-8). Notificação é best-effort.

const REMINDERS_URL = "/payment?tab=documents";

export function resolveFinalReminderStatus(
  deliveries: ReminderDeliveryLogItem[],
): Extract<PaymentReminderStatusValue, "SENT" | "PARTIAL" | "FAILED"> {
  const sentCount = deliveries.filter((delivery) => delivery.status === "SENT").length;
  const failedCount = deliveries.filter((delivery) => delivery.status === "FAILED").length;
  if (sentCount === 0) return "FAILED";
  return failedCount === 0 ? "SENT" : "PARTIAL";
}

async function notifyCreator(params: {
  snapshot: ReminderDispatchSnapshot;
  title: string;
  body: string;
  status: PaymentReminderStatusValue;
}) {
  if (!params.snapshot.notifyCreator) return;
  try {
    await createNotification({
      userId: params.snapshot.createdById,
      organizationId: params.snapshot.organizationId,
      type: "PAYMENT_DUNNING_SENT",
      title: params.title,
      body: params.body,
      appKey: "financeiro",
      actionUrl: REMINDERS_URL,
      severity: params.status === "FAILED" ? "warning" : "info",
      metadata: { reminderId: params.snapshot.reminderId, status: params.status },
    });
  } catch (error) {
    console.error("[payment/reminder] notify creator failed", error);
  }
}

function describeTarget(snapshot: ReminderDispatchSnapshot): string {
  return snapshot.entry ? `"${snapshot.entry.description}"` : "o documento";
}

export async function finalizeReminderDelivery(params: {
  snapshot: ReminderDispatchSnapshot;
  deliveries: ReminderDeliveryLogItem[];
}) {
  const status = resolveFinalReminderStatus(params.deliveries);
  const sentDeliveries = params.deliveries.filter((delivery) => delivery.status === "SENT");
  const starsCharged = params.deliveries.reduce((total, delivery) => total + delivery.starsCharged, 0);

  await prisma.paymentReminder.update({
    where: { id: params.snapshot.reminderId },
    data: {
      status,
      sentAt: sentDeliveries.length > 0 ? new Date() : null,
      deliveryLog: params.deliveries as unknown as object,
    },
  });

  const failureSummary = params.deliveries
    .filter((delivery) => delivery.status === "FAILED")
    .map((delivery) => `${delivery.recipientName} (${delivery.channel === "WHATSAPP" ? "WhatsApp" : "e-mail"}): ${delivery.reason ?? "erro"}`)
    .join("; ");

  const title =
    status === "SENT" ? "Lembrete enviado" : status === "PARTIAL" ? "Lembrete enviado em parte" : "Lembrete não enviado";
  const body =
    status === "FAILED"
      ? `Não consegui enviar ${describeTarget(params.snapshot)}. ${failureSummary}`
      : `Enviei ${describeTarget(params.snapshot)} em ${sentDeliveries.length} envio(s).${failureSummary ? ` Falhas: ${failureSummary}` : ""}`;

  await notifyCreator({ snapshot: params.snapshot, title, body: body.slice(0, 500), status });

  return { status, sentCount: sentDeliveries.length, starsCharged };
}

export async function markReminderSkipped(params: { snapshot: ReminderDispatchSnapshot; reason: string }) {
  const { count } = await prisma.paymentReminder.updateMany({
    where: { id: params.snapshot.reminderId, status: "SCHEDULED" },
    data: { status: "SKIPPED", deliveryLog: [] },
  });
  if (count === 0) return { status: "SKIPPED" as const, wasUpdated: false };

  await notifyCreator({
    snapshot: params.snapshot,
    title: "Lembrete não enviado",
    body: `O lembrete de ${describeTarget(params.snapshot)} não foi enviado: ${params.reason}.`,
    status: "SKIPPED",
  });
  return { status: "SKIPPED" as const, wasUpdated: true };
}
