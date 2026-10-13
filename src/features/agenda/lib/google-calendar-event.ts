import "server-only";
import prisma from "@/lib/prisma";
import { resolveGoogleAccessToken } from "@/features/integrations/lib/oauth/resolve-google-access-token";

// Evento do Google Agenda de um agendamento, com link do Meet em reunião on-line (spec 0100, RF-13 a RF-15).
// Usado pelo botão "Sincronizar" da agenda e pelo Astro ao marcar, remarcar e cancelar na conversa.

export const GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";
const EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const AGENDA_TIME_ZONE = "America/Sao_Paulo";
const MAX_REMINDER_MINUTES = 40_320;

export type GoogleEventFailure = "no_integration" | "missing_scope" | "missing_token" | "refresh_failed" | "not_found" | "not_synced" | "google_refused";

export type GoogleEventResult =
  | { ok: true; eventId: string | null; htmlLink: string | null; meetLink: string | null; attendeeEmail: string | null }
  | { ok: false; reason: GoogleEventFailure; message: string };

interface GoogleEventResponse {
  id?: string;
  htmlLink?: string;
  hangoutLink?: string;
}

interface GoogleEventScope {
  appointmentId: string;
  organizationId: string;
  /** Quem autorizou o Google pelo login; sem ele vale a integração Google da empresa. */
  userId?: string | null;
}

async function resolveAccessToken(scope: GoogleEventScope): Promise<{ accessToken: string } | Extract<GoogleEventResult, { ok: false }>> {
  const resolved = await resolveGoogleAccessToken({
    organizationId: scope.organizationId,
    userId: scope.userId ?? undefined,
    requiredScope: GOOGLE_CALENDAR_SCOPE,
  });
  if (!resolved.ok) return { ok: false, reason: resolved.reason, message: resolved.message };
  return { accessToken: resolved.accessToken };
}

function loadAppointment(scope: GoogleEventScope) {
  return prisma.appointment.findFirst({
    where: { id: scope.appointmentId, agenda: { organizationId: scope.organizationId } },
    select: {
      id: true,
      title: true,
      notes: true,
      startsAt: true,
      endsAt: true,
      meetingType: true,
      gcalEventId: true,
      lead: { select: { email: true } },
      agenda: { select: { name: true } },
    },
  });
}

function eventTimes(appointment: { startsAt: Date; endsAt: Date }) {
  return {
    start: { dateTime: appointment.startsAt.toISOString(), timeZone: AGENDA_TIME_ZONE },
    end: { dateTime: appointment.endsAt.toISOString(), timeZone: AGENDA_TIME_ZONE },
  };
}

async function refusal(response: Response): Promise<Extract<GoogleEventResult, { ok: false }>> {
  const responseText = await response.text();
  return { ok: false, reason: "google_refused", message: `Google Calendar recusou: ${response.status} ${responseText.slice(0, 200)}` };
}

/**
 * Cria o evento e, em reunião on-line, o link do Meet. Com e-mail no lead, o Google envia o convite.
 * `reminderMinutes` ausente usa o lembrete padrão da agenda do Google.
 */
export async function createGoogleEventForAppointment(scope: GoogleEventScope & { reminderMinutes?: number | null }): Promise<GoogleEventResult> {
  const appointment = await loadAppointment(scope);
  if (!appointment) return { ok: false, reason: "not_found", message: "Agendamento não encontrado" };
  const token = await resolveAccessToken(scope);
  if (!("accessToken" in token)) return token;

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ?? process.env.NEXT_PUBLIC_BASE_URL ?? "";
  const description = [appointment.notes, baseUrl ? `Para reagendar ou cancelar, acesse: ${baseUrl}/agenda/appointment/${appointment.id}` : null]
    .filter(Boolean)
    .join("\n\n");
  const attendeeEmail = appointment.lead?.email?.trim() || null;
  const reminderMinutes =
    typeof scope.reminderMinutes === "number" && scope.reminderMinutes > 0 ? Math.min(Math.round(scope.reminderMinutes), MAX_REMINDER_MINUTES) : null;
  const isOnline = appointment.meetingType === "ONLINE";

  const eventBody: Record<string, unknown> = {
    summary: appointment.title || `Agendamento — ${appointment.agenda.name}`,
    ...(description ? { description } : {}),
    ...eventTimes(appointment),
    ...(attendeeEmail ? { attendees: [{ email: attendeeEmail }] } : {}),
    reminders: reminderMinutes
      ? { useDefault: false, overrides: [{ method: "popup", minutes: reminderMinutes }, { method: "email", minutes: reminderMinutes }] }
      : { useDefault: true },
    ...(isOnline
      ? { conferenceData: { createRequest: { requestId: `nasa-${appointment.id}-${Date.now()}`, conferenceSolutionKey: { type: "hangoutsMeet" } } } }
      : {}),
  };

  const url = new URL(EVENTS_URL);
  url.searchParams.set("sendUpdates", "all");
  if (isOnline) url.searchParams.set("conferenceDataVersion", "1");

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: { Authorization: `Bearer ${token.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(eventBody),
  });
  if (!response.ok) return refusal(response);

  const event = (await response.json()) as GoogleEventResponse;
  if (event.id) {
    await prisma.appointment.update({ where: { id: appointment.id }, data: { gcalEventId: event.id } });
  }
  return { ok: true, eventId: event.id ?? null, htmlLink: event.htmlLink ?? null, meetLink: event.hangoutLink ?? null, attendeeEmail };
}

/** Agendamento remarcado: leva o evento que já existe para o novo horário. O link do Meet continua o mesmo. */
export async function moveGoogleEventForAppointment(scope: GoogleEventScope): Promise<GoogleEventResult> {
  const appointment = await loadAppointment(scope);
  if (!appointment) return { ok: false, reason: "not_found", message: "Agendamento não encontrado" };
  if (!appointment.gcalEventId) return { ok: false, reason: "not_synced", message: "Agendamento sem evento no Google" };
  const token = await resolveAccessToken(scope);
  if (!("accessToken" in token)) return token;

  const response = await fetch(`${EVENTS_URL}/${encodeURIComponent(appointment.gcalEventId)}?sendUpdates=all`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(eventTimes(appointment)),
  });
  if (!response.ok) return refusal(response);
  const event = (await response.json()) as GoogleEventResponse;
  return {
    ok: true,
    eventId: event.id ?? appointment.gcalEventId,
    htmlLink: event.htmlLink ?? null,
    meetLink: event.hangoutLink ?? null,
    attendeeEmail: appointment.lead?.email?.trim() || null,
  };
}

/** Agendamento cancelado: remove o evento e avisa os convidados. */
export async function cancelGoogleEventForAppointment(scope: GoogleEventScope): Promise<{ ok: boolean }> {
  const appointment = await loadAppointment(scope);
  if (!appointment?.gcalEventId) return { ok: false };
  const token = await resolveAccessToken(scope);
  if (!("accessToken" in token)) return { ok: false };

  const response = await fetch(`${EVENTS_URL}/${encodeURIComponent(appointment.gcalEventId)}?sendUpdates=all`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token.accessToken}` },
  });
  // 410 = o evento já tinha sido apagado no Google.
  if (!response.ok && response.status !== 410) return { ok: false };
  await prisma.appointment.update({ where: { id: appointment.id }, data: { gcalEventId: null } });
  return { ok: true };
}
