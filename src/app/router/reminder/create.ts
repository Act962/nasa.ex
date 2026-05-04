import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { buildFirstRemindAt } from "@/lib/reminder-recurrence";
import { logActivity } from "@/lib/activity-logger";
import prisma from "@/lib/prisma";
import { inngest } from "@/inngest/client";
import { ReminderRecurrenceType } from "@/generated/prisma/enums";
import z from "zod";

export const createReminder = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    path: "/reminder/create",
    summary: "Create a recurring reminder",
  })
  .input(
    z
      .object({
        message: z.string().min(1),
        recurrenceType: z.nativeEnum(ReminderRecurrenceType),
        // Para MONTHLY com dia fixo: apenas dayOfMonth + remindTime são necessários
        dayOfMonth: z.number().min(1).max(28).optional(),
        remindTime: z.string().regex(/^\d{2}:\d{2}$/),
        // Obrigatório para ONCE / WEEKLY / BIWEEKLY e MONTHLY sem dayOfMonth
        firstRemindAt: z.string().datetime().optional(),
        notifyPhone: z.string().optional(),
        leadId: z.string().optional(),
        conversationId: z.string().optional(),
        trackingId: z.string().optional(),
        actionId: z.string().optional(),
      })
      .refine(
        (data) =>
          data.dayOfMonth !== undefined ||
          data.firstRemindAt !== undefined,
        {
          message: "Informe firstRemindAt ou dayOfMonth para calcular o primeiro disparo",
          path: ["firstRemindAt"],
        },
      ),
  )
  .handler(async ({ input, context }) => {
    const {
      message,
      recurrenceType,
      dayOfMonth,
      remindTime,
      firstRemindAt,
      notifyPhone,
      leadId,
      conversationId,
      trackingId,
      actionId,
    } = input;

    // Calcula a primeira data de disparo
    const nextRemindAt = buildFirstRemindAt(remindTime, firstRemindAt, dayOfMonth);

    // 1. Persiste o lembrete no banco
    const reminder = await prisma.reminder.create({
      data: {
        createdByUserId: context.user.id,
        message,
        recurrenceType,
        dayOfMonth: dayOfMonth ?? null,
        remindTime,
        notifyPhone: notifyPhone ?? null,
        nextRemindAt,
        leadId: leadId ?? null,
        conversationId: conversationId ?? null,
        trackingId: trackingId ?? null,
        actionId: actionId ?? null,
      },
    });

    // 2. Dispara o job Inngest que hibernará até nextRemindAt e então enviará o WhatsApp
    await inngest.send({
      name: "reminder/created",
      data: { reminderId: reminder.id },
    });

    // 3. Tenta resolver organizationId via referências (lead/conversation/tracking/action)
    let organizationId: string | undefined;
    let leadName: string | undefined;
    let trackingName: string | undefined;
    if (leadId) {
      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
        select: {
          name: true,
          tracking: { select: { organizationId: true, name: true } },
        },
      });
      organizationId = lead?.tracking?.organizationId;
      leadName = lead?.name;
      trackingName = lead?.tracking?.name;
    } else if (conversationId) {
      const conv = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: {
          tracking: { select: { organizationId: true, name: true } },
          lead: { select: { name: true } },
        },
      });
      organizationId = conv?.tracking?.organizationId;
      leadName = conv?.lead?.name;
      trackingName = conv?.tracking?.name;
    } else if (trackingId) {
      const tr = await prisma.tracking.findUnique({
        where: { id: trackingId },
        select: { organizationId: true, name: true },
      });
      organizationId = tr?.organizationId;
      trackingName = tr?.name;
    } else {
      const member = await prisma.member.findFirst({
        where: { userId: context.user.id },
        select: { organizationId: true },
      });
      organizationId = member?.organizationId;
    }

    if (organizationId) {
      const isRecurring = recurrenceType !== ReminderRecurrenceType.ONCE;
      const subjectName = leadName ?? trackingName ?? "lembrete";
      await logActivity({
        organizationId,
        userId: context.user.id,
        userName: context.user.name,
        userEmail: context.user.email,
        userImage: (context.user as any).image,
        appSlug: "chat",
        subAppSlug: isRecurring ? "tracking-reminders-recurring" : "tracking-reminders",
        featureKey: isRecurring ? "reminder.recurring.created" : "reminder.created",
        action: isRecurring ? "reminder.recurring.created" : "reminder.created",
        actionLabel: isRecurring
          ? `Criou lembrete recorrente (${recurrenceType.toLowerCase()}) para "${subjectName}"`
          : `Criou lembrete para "${subjectName}"`,
        resource: subjectName,
        resourceId: reminder.id,
        metadata: {
          recurrenceType,
          leadId: leadId ?? undefined,
          conversationId: conversationId ?? undefined,
          trackingId: trackingId ?? undefined,
          actionId: actionId ?? undefined,
          remindTime,
          dayOfMonth: dayOfMonth ?? undefined,
          nextRemindAt,
        },
      });
    }

    return { reminder };
  });
