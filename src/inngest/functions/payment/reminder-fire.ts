import "server-only";

import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import type { ReminderDeliveryLogItem } from "@/features/payment/schemas/reminders";
import {
  deliverReminderToRecipient,
  loadReminderForDispatch,
} from "@/features/payment/server/reminders/dispatch-reminder";
import {
  finalizeReminderDelivery,
  markReminderSkipped,
} from "@/features/payment/server/reminders/finalize-reminder";
import { PAYMENT_REMINDER_EVENTS } from "@/features/payment/server/reminders/create-reminder";

// Lembrete com envio de documento (spec 0017): dorme até `remindAt`, recarrega
// e entrega por destinatário/canal, cada envio num step próprio.

interface PaymentReminderEventData {
  reminderId: string;
  organizationId: string;
}

export const paymentReminderFire = inngest.createFunction(
  {
    id: "payment-reminder-fire",
    retries: 2,
    concurrency: { key: "event.data.organizationId", limit: 3 },
    cancelOn: [{ event: PAYMENT_REMINDER_EVENTS.cancelled, match: "data.reminderId" }],
  },
  { event: PAYMENT_REMINDER_EVENTS.created },
  async ({ event, step, logger }) => {
    const { reminderId } = event.data as PaymentReminderEventData;

    const scheduled = await step.run("load-reminder", () =>
      prisma.paymentReminder.findUnique({
        where: { id: reminderId },
        select: { status: true, remindAt: true },
      }),
    );
    if (!scheduled || scheduled.status !== "SCHEDULED") {
      return { skipped: "not_scheduled" };
    }

    await step.sleepUntil("wait-until-remind-at", new Date(scheduled.remindAt));

    const dispatch = await step.run("reload-reminder", () => loadReminderForDispatch(reminderId));

    if (dispatch.shouldSkip) {
      logger.info(`[payment/reminder] skip ${dispatch.reason}`, { reminderId });
      if (dispatch.reason === "entry_settled" && dispatch.snapshot) {
        const snapshot = dispatch.snapshot;
        await step.run("mark-skipped", () =>
          markReminderSkipped({ snapshot, reason: "o lançamento já está pago ou cancelado" }),
        );
      }
      return { skipped: dispatch.reason };
    }

    const { snapshot } = dispatch;
    const deliveries: ReminderDeliveryLogItem[] = [];

    for (const [recipientIndex, recipient] of snapshot.recipients.entries()) {
      for (const channel of snapshot.channels) {
        const delivery = await step.run(`deliver-${recipientIndex}-${channel.toLowerCase()}`, () =>
          deliverReminderToRecipient({ snapshot, recipient, channel }),
        );
        deliveries.push(delivery);
      }
    }

    return step.run("finalize", () => finalizeReminderDelivery({ snapshot, deliveries }));
  },
);
