import "server-only";
import {
  registerProposalExecutor,
  type ProposalExecutionResult,
} from "@/features/astro/server/tools/_shared/proposals/types";
import type {
  PaymentReminderChannelValue,
  ReminderRecipient,
} from "@/features/payment/schemas/reminders";
import { createPaymentReminderRecord } from "@/features/payment/server/reminders/create-reminder";
import { cancelPaymentReminderRecord } from "@/features/payment/server/reminders/cancel-reminder";
import { PaymentReminderError } from "@/features/payment/server/reminders/errors";
import { assertPaymentToolAccess } from "./access";
import { formatReminderDateTime } from "./reminder-dates";

// Executores das propostas de lembrete (spec 0017, RF-2/RF-5). Rodam só
// depois do "sim", via `confirm_action`, com os mesmos serviços da tela.

export const FINANCE_REMINDER_ACTION_TYPES = {
  createReminder: "payment.reminder.create",
  cancelReminder: "payment.reminder.cancel",
} as const;

const REMINDERS_LINK = { label: "Ver lembretes", href: "/payment?tab=documents" };

export interface CreateReminderProposalPayload {
  entryId?: string;
  attachmentId?: string;
  /** ISO 8601 com fuso. */
  remindAtIso: string;
  channels: PaymentReminderChannelValue[];
  recipients: ReminderRecipient[];
  message?: string;
  notifyCreator: boolean;
}

export interface CancelReminderProposalPayload {
  reminderId: string;
}

function describeFailure(error: unknown, fallback: string): string {
  if (error instanceof PaymentReminderError) return error.message;
  return error instanceof Error ? error.message : fallback;
}

registerProposalExecutor<CreateReminderProposalPayload>(
  FINANCE_REMINDER_ACTION_TYPES.createReminder,
  async ({ ctx, payload }): Promise<ProposalExecutionResult> => {
    const access = await assertPaymentToolAccess(ctx, "entries", "edit");
    if (!access.ok) return { ok: false, summary: access.error };

    try {
      const reminder = await createPaymentReminderRecord({
        organizationId: ctx.organizationId,
        createdById: ctx.userId,
        entryId: payload.entryId,
        attachmentId: payload.attachmentId,
        remindAt: new Date(payload.remindAtIso),
        channels: payload.channels,
        recipients: payload.recipients,
        message: payload.message,
        notifyCreator: payload.notifyCreator,
      });
      return {
        ok: true,
        summary: `Lembrete agendado para ${formatReminderDateTime(reminder.remindAt)}.`,
        lines: [
          { label: "Quando", value: formatReminderDateTime(reminder.remindAt) },
          { label: "Destinatários", value: reminder.recipients.map((recipient) => recipient.name).join(", ") },
        ],
        links: [REMINDERS_LINK],
        data: { reminderId: reminder.id },
      };
    } catch (error) {
      return { ok: false, summary: describeFailure(error, "Não consegui agendar o lembrete.") };
    }
  },
);

registerProposalExecutor<CancelReminderProposalPayload>(
  FINANCE_REMINDER_ACTION_TYPES.cancelReminder,
  async ({ ctx, payload }): Promise<ProposalExecutionResult> => {
    const access = await assertPaymentToolAccess(ctx, "entries", "edit");
    if (!access.ok) return { ok: false, summary: access.error };

    try {
      const result = await cancelPaymentReminderRecord({
        organizationId: ctx.organizationId,
        reminderId: payload.reminderId,
      });
      return {
        ok: true,
        summary: result.wasAlreadyCancelled ? "Esse lembrete já estava cancelado." : "Lembrete cancelado. Nada será enviado.",
        links: [REMINDERS_LINK],
        data: { reminderId: payload.reminderId },
      };
    } catch (error) {
      return { ok: false, summary: describeFailure(error, "Não consegui cancelar o lembrete.") };
    }
  },
);
