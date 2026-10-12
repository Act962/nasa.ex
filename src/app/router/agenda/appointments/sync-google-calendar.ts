import { z } from "zod";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { createGoogleEventForAppointment } from "@/features/agenda/lib/google-calendar-event";

const CALENDAR_TOKEN_MESSAGES = {
  no_integration:
    "Pra sincronizar com o Google Calendar, faça login com Google (e autorize Calendário) ou conecte a integração Google em /integrations.",
  missing_scope:
    "A integração Google atual não tem permissão de Calendário. Reconecte em /integrations pra autorizar o novo escopo.",
} as const;

export const syncAppointmentToGoogleCalendar = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      appointmentId: z.string().min(1),
    }),
  )
  .handler(async ({ context, input, errors }) => {
    const appointment = await prisma.appointment.findFirst({
      where: { id: input.appointmentId, agenda: { organizationId: context.org.id } },
      select: { id: true, lead: { select: { email: true } } },
    });

    if (!appointment) {
      throw errors.NOT_FOUND({ message: "Agendamento não encontrado" });
    }

    if (!appointment.lead?.email) {
      throw errors.BAD_REQUEST({
        message:
          "O lead deste agendamento não tem e-mail cadastrado — não há para quem mandar o convite.",
      });
    }

    const synced = await createGoogleEventForAppointment({
      appointmentId: appointment.id,
      organizationId: context.org.id,
      userId: context.user.id,
    });
    if (!synced.ok) {
      if (synced.reason === "google_refused") throw errors.INTERNAL_SERVER_ERROR({ message: synced.message });
      const message =
        synced.reason === "no_integration" || synced.reason === "missing_scope" ? CALENDAR_TOKEN_MESSAGES[synced.reason] : synced.message;
      throw errors.BAD_REQUEST({ message });
    }

    return {
      success: true,
      eventId: synced.eventId,
      htmlLink: synced.htmlLink,
      meetLink: synced.meetLink,
      attendeeEmail: synced.attendeeEmail ?? appointment.lead.email,
    };
  });
