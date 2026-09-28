import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requirePaymentAccess } from "@/app/middlewares/payment-access";
import { logActivity } from "@/features/admin/lib/activity-logger";
import { z } from "zod";
import {
  PAYMENT_REMINDER_CHANNELS,
  PAYMENT_REMINDER_STATUSES,
  REMINDER_MAX_RECIPIENTS,
  REMINDER_MESSAGE_MAX_LENGTH,
  reminderDeliveryLogItemSchema,
  reminderRecipientSchema,
} from "@/features/payment/schemas/reminders";
import { createPaymentReminderRecord } from "@/features/payment/server/reminders/create-reminder";
import { cancelPaymentReminderRecord } from "@/features/payment/server/reminders/cancel-reminder";
import { queryPaymentReminders } from "@/features/payment/server/reminders/list-reminders";
import { PaymentReminderError } from "@/features/payment/server/reminders/errors";

// Lembretes com envio de documento (spec 0017). Lógica em
// `features/payment/server/reminders/*`, compartilhada com o Astro.

const reminderShape = z.object({
  id: z.string(),
  entryId: z.string().nullable(),
  attachmentId: z.string().nullable(),
  remindAt: z.date(),
  channels: z.array(z.enum(PAYMENT_REMINDER_CHANNELS)),
  recipients: z.array(reminderRecipientSchema),
  message: z.string(),
  notifyCreator: z.boolean(),
  status: z.enum(PAYMENT_REMINDER_STATUSES),
  sentAt: z.date().nullable(),
  deliveryLog: z.array(reminderDeliveryLogItemSchema),
  createdAt: z.date(),
  entry: z
    .object({
      id: z.string(),
      description: z.string(),
      amount: z.number(),
      dueDate: z.date(),
      status: z.string(),
      type: z.enum(["RECEIVABLE", "PAYABLE"]),
    })
    .nullable(),
  attachment: z.object({ id: z.string(), fileName: z.string(), mimeType: z.string() }).nullable(),
  createdBy: z.object({ id: z.string(), name: z.string().nullable() }),
});

export const listPaymentRemindersProcedure = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requirePaymentAccess("entries", "view"))
  .route({ method: "GET", summary: "List payment reminders", tags: ["Payment"] })
  .input(
    z.object({
      entryId: z.string().optional(),
      status: z.enum(PAYMENT_REMINDER_STATUSES).optional(),
      limit: z.number().int().min(1).max(200).optional(),
    }),
  )
  .output(z.object({ reminders: z.array(reminderShape) }))
  .handler(async ({ input, context }) => {
    const reminders = await queryPaymentReminders({
      organizationId: context.org.id,
      entryId: input.entryId,
      status: input.status,
      limit: input.limit,
    });
    return { reminders };
  });

export const createPaymentReminderProcedure = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requirePaymentAccess("entries", "edit"))
  .route({ method: "POST", summary: "Create payment reminder", tags: ["Payment"] })
  .input(
    z.object({
      entryId: z.string().optional(),
      attachmentId: z.string().optional(),
      remindAt: z.string().datetime({ offset: true }),
      channels: z.array(z.enum(PAYMENT_REMINDER_CHANNELS)).min(1),
      recipients: z.array(reminderRecipientSchema).min(1).max(REMINDER_MAX_RECIPIENTS),
      message: z.string().max(REMINDER_MESSAGE_MAX_LENGTH).optional(),
      notifyCreator: z.boolean().optional(),
    }),
  )
  .output(z.object({ reminderId: z.string(), remindAt: z.date() }))
  .handler(async ({ input, context, errors }) => {
    try {
      const reminder = await createPaymentReminderRecord({
        organizationId: context.org.id,
        createdById: context.user.id,
        entryId: input.entryId,
        attachmentId: input.attachmentId,
        remindAt: new Date(input.remindAt),
        channels: input.channels,
        recipients: input.recipients,
        message: input.message,
        notifyCreator: input.notifyCreator,
      });

      await logActivity({
        organizationId: context.org.id,
        userId: context.user.id,
        userName: context.user.name,
        userEmail: context.user.email,
        userImage: null,
        appSlug: "payment",
        subAppSlug: "payment-reminders",
        featureKey: "payment.reminder.created",
        action: "payment.reminder.created",
        actionLabel: `Agendou lembrete para ${reminder.recipients.map((recipient) => recipient.name).join(", ")}`,
        resource: "PaymentReminder",
        resourceId: reminder.id,
        metadata: { entryId: reminder.entryId, channels: reminder.channels, remindAt: reminder.remindAt.toISOString() },
      });

      return { reminderId: reminder.id, remindAt: reminder.remindAt };
    } catch (error) {
      if (error instanceof PaymentReminderError) throw errors.BAD_REQUEST({ message: error.message });
      throw error;
    }
  });

export const cancelPaymentReminderProcedure = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requirePaymentAccess("entries", "edit"))
  .route({ method: "POST", summary: "Cancel payment reminder", tags: ["Payment"] })
  .input(z.object({ reminderId: z.string() }))
  .output(z.object({ reminderId: z.string(), wasAlreadyCancelled: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    try {
      const result = await cancelPaymentReminderRecord({
        organizationId: context.org.id,
        reminderId: input.reminderId,
      });

      if (!result.wasAlreadyCancelled) {
        await logActivity({
          organizationId: context.org.id,
          userId: context.user.id,
          userName: context.user.name,
          userEmail: context.user.email,
          userImage: null,
          appSlug: "payment",
          subAppSlug: "payment-reminders",
          featureKey: "payment.reminder.cancelled",
          action: "payment.reminder.cancelled",
          actionLabel: "Cancelou lembrete financeiro",
          resource: "PaymentReminder",
          resourceId: input.reminderId,
        });
      }

      return result;
    } catch (error) {
      if (error instanceof PaymentReminderError) throw errors.BAD_REQUEST({ message: error.message });
      throw error;
    }
  });
