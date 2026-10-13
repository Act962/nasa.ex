import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import { resolveOutboundProvider } from "@/features/tracking-chat/lib/providers";
import {
  isFreeFormWindowOpen,
  WINDOW_CLOSED_SKIP_REASON,
} from "@/features/tracking-chat/lib/providers/automated-outbound";
import { chargeStarsByAction } from "@/features/stars/lib/charge-by-action";
import { buildAppointmentPublicUrl } from "@/features/astro/actions/agenda/schedule-steps";
import { resend } from "@/lib/email/resend";

const AGENDA_TIME_ZONE = "America/Sao_Paulo";

function formatInAgendaTimeZone(date: Date, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: AGENDA_TIME_ZONE, ...options }).format(date);
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

type BookingEmail = { to: string; type: "created" | "cancelled"; clientName: string; agendaName: string; date: string; time: string; link: string };

/** E-mail do agendamento (spec 0100, RF-9). Falha aqui nunca derruba a confirmação por WhatsApp. */
async function sendBookingEmail(email: BookingEmail): Promise<"sent" | "failed"> {
  const isCreated = email.type === "created";
  const heading = isCreated ? "Agendamento confirmado" : "Agendamento cancelado";
  const action = isCreated ? "Ver, remarcar ou cancelar o agendamento" : "Agendar um novo horário";
  const html = [
    `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#1f2937;line-height:1.5">`,
    `<h2 style="margin:0 0 12px">${heading}</h2>`,
    `<p>Olá, ${escapeHtml(email.clientName)}.</p>`,
    `<p><strong>Data:</strong> ${email.date}<br><strong>Horário:</strong> ${email.time}<br><strong>Agenda:</strong> ${escapeHtml(email.agendaName)}</p>`,
    `<p><a href="${email.link}">${action}</a></p>`,
    `</div>`,
  ].join("");
  try {
    const { error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? "noreply@nasaex.com",
      to: email.to,
      subject: `${heading}: ${email.date} às ${email.time}`,
      html,
    });
    if (error) {
      console.error("[booking-notification] e-mail recusado:", error.message);
      return "failed";
    }
    return "sent";
  } catch (sendError) {
    console.error("[booking-notification] e-mail falhou:", sendError instanceof Error ? sendError.message : sendError);
    return "failed";
  }
}

export type BookingNotificationEvent = {
  data: {
    appointmentId: string;
    type: "created" | "cancelled";
  };
};

/**
 * Job Inngest: avisa o cliente por WhatsApp e por e-mail quando um agendamento
 * é criado ou cancelado pelo chat.
 *
 * O WhatsApp exige instância no funil da agenda; o e-mail exige e-mail no lead.
 * Um canal não depende do outro.
 */
export const bookingNotification = inngest.createFunction(
  { id: "booking-notification", retries: 2 },
  { event: "appointment/booking.notification" },
  async ({ event, step }) => {
    const { appointmentId, type } = event.data as BookingNotificationEvent["data"];

    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        lead: {
          select: {
            phone: true,
            name: true,
            email: true,
            conversation: { select: { id: true } },
          },
        },
        agenda: {
          select: {
            name: true,
            organizationId: true,
            tracking: {
              select: {
                id: true,
                whatsappInstance: { select: { status: true, provider: true } },
              },
            },
          },
        },
      },
    });

    if (!appointment) {
      return { skipped: "appointment_not_found" };
    }

    const date = formatInAgendaTimeZone(appointment.startsAt, { day: "2-digit", month: "2-digit", year: "numeric" });
    const time = formatInAgendaTimeZone(appointment.startsAt, { hour: "2-digit", minute: "2-digit", hour12: false });
    const clientName = appointment.lead?.name ?? "Cliente";
    const agendaName = appointment.agenda.name;

    const leadEmail = appointment.lead?.email?.trim();
    // Em etapa própria: se o WhatsApp falhar e a função rodar de novo, o e-mail não sai duas vezes.
    const email = leadEmail
      ? await step.run("send-booking-email", () =>
          sendBookingEmail({ to: leadEmail, type, clientName, agendaName, date, time, link: buildAppointmentPublicUrl(appointment.id) }),
        )
      : "no_email";

    if (!appointment.lead?.phone) {
      return { skipped: "no_phone", email };
    }

    // Em número da API oficial o campo `status` não acompanha a conexão: quem decide é a janela de 24 h, logo abaixo.
    const instance = appointment.agenda.tracking.whatsappInstance;
    const isOfficialNumber = instance?.provider === "META_CLOUD";
    if (!instance || (!isOfficialNumber && instance.status !== "CONNECTED")) {
      return { skipped: "whatsapp_not_connected", email };
    }

    const resolved = await resolveOutboundProvider(appointment.agenda.tracking.id);
    const canSendFreeForm = await isFreeFormWindowOpen(
      resolved,
      appointment.lead.conversation?.id,
    );
    if (!canSendFreeForm) {
      return { skipped: WINDOW_CLOSED_SKIP_REASON, appointmentId, email };
    }

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
      return { skipped: "insufficient_stars", appointmentId, email };
    }

    await resolved.provider.sendText({
      kind: "text",
      to: appointment.lead.phone,
      body: message,
    });

    return { sent: true, to: appointment.lead.phone, type, email };
  },
);
