import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import { sendText } from "@/http/uazapi/send-text";
import { requireUazapiToken } from "@/features/tracking-chat/lib/providers/uazapi-credentials";
import { chargeStarsByAction } from "@/features/stars/lib/charge-by-action";
import dayjs from "dayjs";
import "dayjs/locale/pt-br";

export type BookingNotificationEvent = {
  data: {
    appointmentId: string;
    type: "created" | "cancelled";
  };
};

/**
 * Job Inngest: envia notificação WhatsApp ao cliente quando um agendamento
 * é criado ou cancelado via chat público.
 *
 * Requer que a trilha (tracking) da agenda tenha uma instância WhatsApp
 * conectada. Se não houver, o job finaliza sem erro.
 */
export const bookingNotification = inngest.createFunction(
  { id: "booking-notification", retries: 2 },
  { event: "appointment/booking.notification" },
  async ({ event }) => {
    const { appointmentId, type } = event.data as BookingNotificationEvent["data"];

    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        lead: {
          select: { phone: true, name: true },
        },
        agenda: {
          select: {
            name: true,
            organizationId: true,
            tracking: {
              select: {
                whatsappInstance: {
                  select: {
                    apiKey: true,
                    baseUrl: true,
                    status: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!appointment) {
      return { skipped: "appointment_not_found" };
    }

    if (!appointment.lead?.phone) {
      return { skipped: "no_phone" };
    }

    const instance = appointment.agenda.tracking.whatsappInstance;
    if (!instance || instance.status !== "CONNECTED") {
      return { skipped: "whatsapp_not_connected" };
    }

    const date = dayjs(appointment.startsAt).locale("pt-br").format("DD/MM/YYYY");
    const time = dayjs(appointment.startsAt).format("HH:mm");
    const clientName = appointment.lead.name ?? "Cliente";
    const agendaName = appointment.agenda.name;

    const message =
      type === "created"
        ? [
            `✅ *Agendamento confirmado, ${clientName}!*`,
            ``,
            `📅 *Data:* ${date}`,
            `🕐 *Horário:* ${time}`,
            `📍 *Agenda:* ${agendaName}`,
            ``,
            `🔖 *ID do agendamento:* \`${appointment.id}\``,
            ``,
            `Para cancelar, entre em contato com o nosso chat e informe o ID acima.`,
          ].join("\n")
        : [
            `❌ *Agendamento cancelado.*`,
            ``,
            `📅 ${date} às ${time}`,
            `📍 ${agendaName}`,
            ``,
            `Se desejar reagendar, acesse novamente o link de agendamento.`,
          ].join("\n");

    const charge = await chargeStarsByAction(
      appointment.agenda.organizationId,
      "message_send",
      {
        appSlug: "message_send",
        description: `Booking ${type} — ${agendaName}`,
      },
    );
    if (!charge.success) {
      return { skipped: "insufficient_stars", appointmentId };
    }

    await sendText(
      requireUazapiToken(instance.apiKey),
      { number: appointment.lead.phone, text: message },
      instance.baseUrl ?? undefined,
    );

    return { sent: true, to: appointment.lead.phone, type };
  },
);
