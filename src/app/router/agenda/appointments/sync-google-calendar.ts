import { z } from "zod";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { refreshGoogleToken } from "@/features/integrations/lib/oauth/google-config";

const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

interface GoogleIntegrationConfig {
  accessToken?: string | null;
  refreshToken?: string | null;
  expiresAt?: number | null;
  scopes?: string | string[] | null;
  userEmail?: string | null;
}

interface CalendarEventInsertResponse {
  id?: string;
  htmlLink?: string;
  hangoutLink?: string;
}

interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  token_type: string;
}

function hasCalendarScope(scopes: string | string[] | null | undefined): boolean {
  if (!scopes) return false;
  const list = Array.isArray(scopes) ? scopes : scopes.split(/\s+/);
  return list.includes(CALENDAR_SCOPE);
}

/** Refresca usando credenciais do better-auth (login Google). */
async function refreshAuthAccountToken(
  refreshToken: string,
): Promise<GoogleTokenResponse> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID/SECRET ausentes");
  }
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Auth Google refresh falhou: ${res.status} ${text}`);
  }
  return (await res.json()) as GoogleTokenResponse;
}

interface ResolvedGoogleToken {
  accessToken: string;
  source: "auth-login" | "integration";
}

/** Tenta usar o token do login (better-auth Account) primeiro; se não tiver
 *  scope de calendar ou estiver indisponível, cai pra PlatformIntegration. */
async function resolveCalendarToken(
  organizationId: string,
  userId: string,
): Promise<ResolvedGoogleToken | { error: string }> {
  // ── Opção A: token do login Google (better-auth) ─────────────────────────
  const account = await prisma.account.findFirst({
    where: { userId, providerId: "google" },
    select: {
      id: true,
      accessToken: true,
      refreshToken: true,
      accessTokenExpiresAt: true,
      scope: true,
    },
  });

  if (account?.accessToken && hasCalendarScope(account.scope)) {
    let accessToken = account.accessToken;
    const expires = account.accessTokenExpiresAt
      ? account.accessTokenExpiresAt.getTime()
      : 0;
    const now = Date.now();

    if (expires && expires - 60_000 < now && account.refreshToken) {
      try {
        const refreshed = await refreshAuthAccountToken(account.refreshToken);
        accessToken = refreshed.access_token;
        await prisma.account.update({
          where: { id: account.id },
          data: {
            accessToken: refreshed.access_token,
            accessTokenExpiresAt: new Date(
              now + refreshed.expires_in * 1000,
            ),
            ...(refreshed.refresh_token
              ? { refreshToken: refreshed.refresh_token }
              : {}),
            ...(refreshed.scope ? { scope: refreshed.scope } : {}),
          },
        });
      } catch {
        // Se refresh falhar, ignora e tenta a integração
        accessToken = "";
      }
    }

    if (accessToken) return { accessToken, source: "auth-login" };
  }

  // ── Opção B: PlatformIntegration (fluxo de Integrações) ──────────────────
  const integration = await prisma.platformIntegration.findFirst({
    where: { organizationId, platform: "GMAIL", isActive: true },
  });

  if (!integration) {
    return {
      error:
        "Pra sincronizar com o Google Calendar, faça login com Google (e autorize Calendário) ou conecte a integração Google em /integracoes.",
    };
  }

  const config = (integration.config ?? {}) as unknown as GoogleIntegrationConfig;

  if (!hasCalendarScope(config.scopes)) {
    return {
      error:
        "A integração Google atual não tem permissão de Calendário. Reconecte em /integracoes pra autorizar o novo escopo.",
    };
  }

  let accessToken = config.accessToken ?? "";
  const refreshToken = config.refreshToken ?? null;
  const expiresAt = config.expiresAt ?? 0;
  const now = Date.now();

  if (!accessToken) {
    return { error: "Token Google ausente. Reconecte a integração." };
  }

  if (expiresAt && expiresAt - 60_000 < now && refreshToken) {
    try {
      const refreshed = await refreshGoogleToken(refreshToken);
      accessToken = refreshed.access_token;
      const newConfig: GoogleIntegrationConfig = {
        ...config,
        accessToken: refreshed.access_token,
        refreshToken: refreshed.refresh_token ?? refreshToken,
        expiresAt: now + refreshed.expires_in * 1000,
        scopes: refreshed.scope,
      };
      await prisma.platformIntegration.update({
        where: { id: integration.id },
        data: { config: newConfig as unknown as object },
      });
    } catch (err) {
      return {
        error: `Falha ao renovar token Google: ${(err as Error).message}. Reconecte a integração.`,
      };
    }
  }

  return { accessToken, source: "integration" };
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
    const resolved = await resolveCalendarToken(
      context.org.id,
      context.user.id,
    );
    if ("error" in resolved) {
      throw errors.BAD_REQUEST({ message: resolved.error });
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

    // 4. Persiste o eventId via SQL bruto (coluna gcal_event_id, aditiva)
    if (event.id) {
      try {
        await prisma.$executeRawUnsafe(
          `UPDATE "appointments" SET "gcal_event_id" = $1 WHERE id = $2`,
          event.id,
          appointment.id,
        );
      } catch {
        // Coluna pode não existir ainda — operação não bloqueia o sucesso.
      }
    }

    return {
      success: true,
      eventId: event.id ?? null,
      htmlLink: event.htmlLink ?? null,
      meetLink: event.hangoutLink ?? null,
      attendeeEmail: appointment.lead.email,
    };
  });
