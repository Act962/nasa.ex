import { z } from "zod";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { resolveGoogleAccessToken } from "@/features/integrations/lib/oauth/resolve-google-access-token";

const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";

const CALENDAR_TOKEN_MESSAGES = {
  no_integration:
    "Pra sincronizar com o Google Calendar, faça login com Google (e autorize Calendário) ou conecte a integração Google em /integracoes.",
  missing_scope:
    "A integração Google atual não tem permissão de Calendário. Reconecte em /integracoes pra autorizar o novo escopo.",
} as const;

interface CalendarEventInsertResponse {
  id?: string;
  htmlLink?: string;
  hangoutLink?: string;
}

export const syncAppointmentToGoogleCalendar = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      appointmentId: z.string().min(1),
    }),
  )
  .handler(async ({ context, input, errors }) => {
    // 1. Carrega o agendamento + lead + agenda da org do usuário
    const appointment = await prisma.appointment.findFirst({
      where: {
        id: input.appointmentId,
        agenda: { organizationId: context.org.id },
      },
      include: {
        lead: { select: { id: true, name: true, email: true } },
        agenda: { select: { id: true, name: true } },
      },
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

    // 2. Resolve o token: tenta login Google (better-auth) primeiro, depois
    //    cai pra integração configurada em /integracoes.
    const resolved = await resolveGoogleAccessToken({
      organizationId: context.org.id,
      userId: context.user.id,
      requiredScope: CALENDAR_SCOPE,
    });
    if (!resolved.ok) {
      const message =
        resolved.reason === "no_integration" || resolved.reason === "missing_scope"
          ? CALENDAR_TOKEN_MESSAGES[resolved.reason]
          : resolved.message;
      throw errors.BAD_REQUEST({ message });
    }
    const accessToken = resolved.accessToken;

    // 3. Monta o evento e chama a Google Calendar API
    const startsAt = new Date(appointment.startsAt).toISOString();
    const endsAt = new Date(appointment.endsAt).toISOString();
    const meetingType =
      ((appointment as unknown as { meetingType?: "ONLINE" | "IN_PERSON" })
        .meetingType ?? "ONLINE") as "ONLINE" | "IN_PERSON";

    // Link público pra o lead reagendar/cancelar (incluso no description)
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "";
    const publicLink = baseUrl
      ? `${baseUrl}/agenda/appointment/${appointment.id}`
      : "";
    const descriptionParts: string[] = [];
    if (appointment.notes) descriptionParts.push(appointment.notes);
    if (publicLink) {
      descriptionParts.push(
        `\nPara reagendar ou cancelar, acesse: ${publicLink}`,
      );
    }
    const description =
      descriptionParts.length > 0 ? descriptionParts.join("\n") : undefined;

    const eventBody: Record<string, unknown> = {
      summary:
        appointment.title ||
        `Agendamento — ${appointment.agenda.name}` ||
        "Agendamento",
      description,
      start: { dateTime: startsAt, timeZone: "America/Sao_Paulo" },
      end: { dateTime: endsAt, timeZone: "America/Sao_Paulo" },
      attendees: [{ email: appointment.lead.email }],
      reminders: { useDefault: true },
    };

    // Reuniões on-line ganham link do Google Meet automaticamente
    if (meetingType === "ONLINE") {
      eventBody.conferenceData = {
        createRequest: {
          requestId: `nasa-${appointment.id}-${Date.now()}`,
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      };
    }

    const url = new URL(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events",
    );
    url.searchParams.set("sendUpdates", "all"); // dispara o convite por e-mail
    if (meetingType === "ONLINE") {
      url.searchParams.set("conferenceDataVersion", "1");
    }

    const res = await fetch(url.toString(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(eventBody),
    });

    if (!res.ok) {
      const text = await res.text();
      throw errors.INTERNAL_SERVER_ERROR({
        message: `Google Calendar recusou: ${res.status} ${text.slice(0, 200)}`,
      });
    }

    const event = (await res.json()) as CalendarEventInsertResponse;

    if (event.id) {
      await prisma.appointment.update({
        where: { id: appointment.id },
        data: { gcalEventId: event.id },
      });
    }

    return {
      success: true,
      eventId: event.id ?? null,
      htmlLink: event.htmlLink ?? null,
      meetLink: event.hangoutLink ?? null,
      attendeeEmail: appointment.lead.email,
    };
  });
