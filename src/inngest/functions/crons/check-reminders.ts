import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import { sendText } from "@/http/uazapi/send-text";
import { requireUazapiToken } from "@/features/tracking-chat/lib/providers/uazapi-credentials";
import { computeNextRemindAt } from "@/lib/reminder-recurrence";
import { createNotification } from "@/features/admin/lib/notification-service";
import { chargeStarsByAction } from "@/features/stars/lib/charge-by-action";
import { pusherServer } from "@/lib/pusher";
import {
  CreatedMessageProps,
  MessageStatus,
} from "@/features/tracking-chat/types";
import { v4 as uuidv4 } from "uuid";
import dayjs from "dayjs";
import "dayjs/locale/pt-br";

export type ReminderCreatedEvent = {
  data: { reminderId: string };
};

export const processReminder = inngest.createFunction(
  { id: "process-reminder", retries: 2 },
  { event: "reminder/created" },
  async ({ event, step }) => {
    const { reminderId } = event.data as ReminderCreatedEvent["data"];

    // 1. Carrega o lembrete para saber quando hibernar
    const reminder = await step.run("load-reminder", () =>
      prisma.reminder.findUnique({
        where: { id: reminderId },
        include: {
          lead: { select: { id: true, name: true } },
          tracking: {
            select: {
              organizationId: true,
              whatsappInstance: {
                select: { apiKey: true, baseUrl: true, status: true },
              },
            },
          },
        },
      }),
    );

    if (!reminder || !reminder.isActive || !reminder.nextRemindAt) {
      return { skipped: "reminder_inactive_or_not_found" };
    }

    // 2. Hiberna exatamente até o horário do lembrete
    // new Date() garante que funciona mesmo que Inngest serialise o valor como string
    await step.sleepUntil(
      "wait-until-remind-at",
      new Date(reminder.nextRemindAt),
    );

    // 3. Recarrega para confirmar que ainda está ativo (pode ter sido cancelado durante a espera)
    const fresh = await step.run("reload-reminder", () =>
      prisma.reminder.findUnique({
        where: { id: reminderId, isActive: true },
        include: {
          lead: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              temperature: true,
              createdAt: true,
              publicToken: true,
              source: true,
              conversation: { select: { id: true } },
              status: { select: { name: true } },
              tracking: { select: { name: true } },
            },
          },
          conversation: { select: { id: true, leadId: true } },
          createdBy: { select: { id: true, name: true } },
          tracking: {
            select: {
              organizationId: true,
              whatsappInstance: {
                select: { apiKey: true, baseUrl: true, status: true },
              },
            },
          },
          action: {
            select: {
              id: true,
              title: true,
              workspaceId: true,
              organizationId: true,
              participants: { select: { userId: true } },
            },
          },
        },
      }),
    );

    if (!fresh) {
      return { skipped: "cancelled_during_sleep" };
    }

    // 4. Envia WhatsApp se houver instância conectada e telefone configurado
    const instance = fresh.tracking?.whatsappInstance;
    const phone = fresh.notifyPhone;
    let sent = false;

    const lead = fresh.lead;
    const variableMap: Record<string, string> = {
      "{{name}}": lead?.name ?? "",
      "{{nome}}": lead?.name ?? "",
      "{{email}}": lead?.email ?? "",
      "{{phone}}": lead?.phone ?? "",
      "{{contato}}": lead?.phone ?? "",
      "{{data}}": lead?.createdAt
        ? dayjs(lead.createdAt).locale("pt-br").format("DD/MM/YYYY")
        : "",
      "{{data-t}}": lead?.createdAt
        ? dayjs(lead.createdAt).locale("pt-br").format("DD/MM/YYYY HH:mm")
        : "",
      "{{temp}}": lead?.temperature ?? "",
      "{{track}}": lead?.tracking?.name ?? "",
      "{{status}}": lead?.status?.name ?? "",
      "{{fonte}}": lead?.source ?? "",
      "{{public_link}}": lead?.publicToken ?? "",
    };
    let resolvedMessage = fresh.message;
    for (const [key, val] of Object.entries(variableMap)) {
      resolvedMessage = resolvedMessage.replaceAll(key, val);
    }

    if (phone && instance?.status === "CONNECTED") {
      const message = resolvedMessage;

      const orgId = fresh.tracking?.organizationId;
      if (orgId) {
        const charge = await step.run("charge-reminder-message", () =>
          chargeStarsByAction(orgId, "message_send", {
            appSlug: "message_send",
            description: `Lembrete — ${fresh.lead?.name ?? "sem lead"}`,
          }),
        );
        if (!charge.success) {
          return { skipped: "insufficient_stars", reminderId };
        }
      }

      const sendResponse = await step.run("send-whatsapp", () =>
        sendText(
          requireUazapiToken(instance.apiKey),
          { number: phone, text: message },
          instance.baseUrl ?? undefined,
        ),
      );

      sent = true;

      // Salva a mensagem na conversa do tracking, se houver
      const conversationId =
        fresh.conversation?.id ?? fresh.lead?.conversation?.id ?? null;

      if (conversationId) {
        const externalMessageId = sendResponse?.messageid ?? uuidv4();
        const senderName = fresh.createdBy?.name ?? null;
        const currentUserId = fresh.createdBy?.id ?? "";

        await step.run("save-message-in-conversation", async () => {
          const ts = sendResponse?.messageTimestamp;
          const parsed = ts ? new Date(ts) : null;
          const createdAt =
            parsed && !isNaN(parsed.getTime()) ? parsed : new Date();

          try {
            const created = await prisma.message.create({
              data: {
                conversationId,
                body: message,
                messageId: externalMessageId,
                fromMe: true,
                status: MessageStatus.SENT,
                senderName,
                createdAt,
              },
              select: {
                id: true,
                messageId: true,
                body: true,
                createdAt: true,
                fromMe: true,
                status: true,
                mediaUrl: true,
                mediaType: true,
                mediaCaption: true,
                mimetype: true,
                fileName: true,
                quotedMessageId: true,
                conversationId: true,
                senderId: true,
                senderName: true,
                conversation: {
                  select: {
                    id: true,
                    lead: { select: { id: true, name: true } },
                  },
                },
              },
            });

            const messageCreated: CreatedMessageProps = {
              ...created,
              currentUserId,
            };

            await pusherServer.trigger(
              created.conversationId,
              "message:created",
              messageCreated,
            );
          } catch (err) {
            console.error(
              "[reminder] failed to persist message in conversation",
              err,
            );
          }
        });
      }
    }

    // 4b. Se houver action vinculada, notificar participantes via in-app
    if (fresh.action) {
      const action = fresh.action;
      const targetIds = action.participants.map((p) => p.userId);
      const truncated =
        resolvedMessage.length > 60
          ? resolvedMessage.slice(0, 60) + "…"
          : resolvedMessage;
      const actionUrl = `/workspaces/${action.workspaceId}?actionId=${action.id}`;

      await step.run("notify-action-participants", () =>
        Promise.allSettled(
          targetIds.map((userId) =>
            createNotification({
              userId,
              organizationId: action.organizationId ?? undefined,
              type: "CUSTOM",
              appKey: "explorer",
              title: `🔔 Lembrete: ${truncated}`,
              body: `Sobre: ${action.title}`,
              actionUrl,
              metadata: {
                kind: "action_reminder",
                actionId: action.id,
                reminderId: fresh.id,
              },
            }),
          ),
        ),
      );

      // Alert engine — aditivo. Permite que o user configure regras
      // específicas pra `agenda.reminder_fired` com severidade/canal
      // diferente (ex: WhatsApp + popup crítico pra lembretes VIP).
      // O createNotification acima continua disparando a notif passiva
      // padrão pra retrocompat.
      await step.run("alert-engine-reminder-fired", async () => {
        const { eventBus } = await import("@/features/alerts/lib/event-bus");
        await eventBus.publish("agenda.reminder_fired", {
          actionId: action.id,
          reminderId: fresh.id,
          orgId: action.organizationId ?? "",
          participantUserIds: targetIds,
        });
      });

      sent = true;
    }

    // 5. Registra a ocorrência no histórico
    await step.run("save-occurrence", () =>
      prisma.reminderOccurrence.create({
        data: {
          reminderId: fresh.id,
          scheduledAt: new Date(fresh.nextRemindAt!), // reconverte string → Date após serialização
          sent,
          sentAt: sent ? new Date() : null,
        },
      }),
    );

    // 6. Calcula a próxima data e atualiza o lembrete
    // Inngest serializa step.run via JSON, então Date vira string — reconvertemos antes de passar
    const nextRemindAt = computeNextRemindAt({
      recurrenceType: fresh.recurrenceType,
      dayOfMonth: fresh.dayOfMonth,
      nextRemindAt: fresh.nextRemindAt ? new Date(fresh.nextRemindAt) : null,
    });

    await step.run("update-next-remind-at", () =>
      prisma.reminder.update({
        where: { id: fresh.id },
        data: {
          nextRemindAt,
          isActive: nextRemindAt !== null,
        },
      }),
    );

    // 7. Se há próxima ocorrência, dispara novo evento para o job se reagendar
    if (nextRemindAt) {
      await step.run("schedule-next", () =>
        inngest.send({
          name: "reminder/created",
          data: { reminderId: fresh.id },
        }),
      );
    }

    return { sent, nextRemindAt };
  },
);
