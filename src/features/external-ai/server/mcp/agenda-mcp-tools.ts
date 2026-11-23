import "server-only";
import { z } from "zod";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/prisma";
import { normalizeWhatsappPhoneBr } from "@/utils/format-phone";
import { computeAgendaTimeSlots, DEFAULT_AGENDA_TIMEZONE } from "@/features/agenda/server/agenda-slots";
import {
  cancelAgendaAppointment,
  createAgendaAppointment,
  rescheduleAgendaAppointment,
  type AgendaActor,
} from "@/features/agenda/server/appointment-commands";
import { isOrgActionAllowed, resolveOrgPermissions } from "@/features/permissions/server/resolve-org-permissions";
import { AGENDA_SCOPE, type ExternalAiCaller } from "../access-tokens";
import { createScopedToolRunner } from "./tool-runner";

dayjs.extend(utc);
dayjs.extend(timezone);

// Agenda pelo MCP (spec 0146): horários livres e compromissos, pelas mesmas funções da tela e da página pública.

const APP_KEY = "spacetime";
const MAX_SLOT_DAYS = 14;
const MAX_APPOINTMENT_DAYS = 62;
const APPOINTMENTS_LIMIT = 200;
const TZ = DEFAULT_AGENDA_TIMEZONE;
const WEEKDAYS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const NOT_FOUND_AGENDA = "Agenda não encontrada, ou você não tem acesso à Agenda nesta empresa.";
const NOT_FOUND_APPOINTMENT = "Compromisso não encontrado.";

type AgendaAction = "view" | "create" | "edit" | "delete";

const ACTION_LABEL: Record<AgendaAction, string> = { view: "ver", create: "marcar", edit: "remarcar", delete: "cancelar" };

const runAgendaTool = createScopedToolRunner({ scope: AGENDA_SCOPE, appName: "à Agenda", rateLimitKey: "mcp-agenda" });

/** Empresas da pessoa; na chave, só as gravadas nela. */
async function listCallerOrganizationIds(caller: ExternalAiCaller): Promise<string[]> {
  const memberships = await prisma.member.findMany({ where: { userId: caller.userId }, select: { organizationId: true } });
  return memberships
    .map((membership) => membership.organizationId)
    .filter((organizationId) => caller.credential !== "key" || caller.organizationIds.includes(organizationId));
}

async function isAgendaActionAllowed(caller: ExternalAiCaller, organizationId: string, action: AgendaAction): Promise<boolean> {
  if (caller.credential === "key" && !caller.organizationIds.includes(organizationId)) return false;
  return isOrgActionAllowed(await resolveOrgPermissions(caller.userId, organizationId), APP_KEY, action);
}

/** O app aparece para quem pode ver a Agenda em alguma empresa com agenda ativa. Para no primeiro "sim". */
export async function hasAnyAgendaAccess(userId: string): Promise<boolean> {
  const agendas = await prisma.agenda.findMany({
    where: { isActive: true, organization: { members: { some: { userId } } } },
    select: { organizationId: true },
    distinct: ["organizationId"],
  });
  for (const agenda of agendas) {
    if (isOrgActionAllowed(await resolveOrgPermissions(userId, agenda.organizationId), APP_KEY, "view")) return true;
  }
  return false;
}

async function loadAgenda(caller: ExternalAiCaller, agendaId: string, action: AgendaAction) {
  const agenda = await prisma.agenda.findFirst({
    where: { id: agendaId, isActive: true },
    select: { id: true, name: true, slotDuration: true, organizationId: true, trackingId: true },
  });
  if (!agenda || !(await isAgendaActionAllowed(caller, agenda.organizationId, "view"))) throw new Error(NOT_FOUND_AGENDA);
  await assertAction(caller, agenda.organizationId, action);
  return agenda;
}

async function assertAction(caller: ExternalAiCaller, organizationId: string, action: AgendaAction) {
  if (action !== "view" && !(await isAgendaActionAllowed(caller, organizationId, action))) {
    throw new Error(`Seu papel nesta empresa não permite ${ACTION_LABEL[action]} compromissos na Agenda.`);
  }
}

async function loadAppointment(caller: ExternalAiCaller, appointmentId: string, action: AgendaAction) {
  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId },
    select: { id: true, status: true, agendaId: true, agenda: { select: { organizationId: true, slotDuration: true, isActive: true } } },
  });
  if (!appointment || !(await isAgendaActionAllowed(caller, appointment.agenda.organizationId, "view"))) throw new Error(NOT_FOUND_APPOINTMENT);
  await assertAction(caller, appointment.agenda.organizationId, action);
  return appointment;
}

async function loadActor(caller: ExternalAiCaller): Promise<AgendaActor> {
  return prisma.user.findUniqueOrThrow({ where: { id: caller.userId }, select: { id: true, name: true, email: true, image: true } });
}

function assertDay(value: string, field: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !dayjs.tz(value, "YYYY-MM-DD", TZ).isValid()) throw new Error(`Data inválida em ${field}: use AAAA-MM-DD.`);
}

function assertTime(value: string) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) throw new Error("Hora inválida: use HH:mm, ex.: 15:00.");
}

/** Recusa horário que a agenda não oferece livre naquele dia (spec 0146, RF-4). */
async function assertFreeSlot(agenda: { id: string; slotDuration: number }, date: string, time: string, ignoreAppointmentId?: string) {
  // O cálculo da página pública só marca como passado o horário de hoje; dia anterior também é passado.
  if (dayjs.tz(date, "YYYY-MM-DD", TZ).isBefore(dayjs().tz(TZ), "day")) throw new Error(`${date} já passou.`);
  const slots = await computeAgendaTimeSlots({ agenda, date, includeUnavailable: Boolean(ignoreAppointmentId) });
  // Ao remarcar, o horário atual do próprio compromisso conta como livre.
  const freeTimes = ignoreAppointmentId
    ? await freeTimesIgnoring(agenda, date, slots, ignoreAppointmentId)
    : slots.map((slot) => slot.startTime);
  if (!freeTimes.includes(time)) {
    throw new Error(
      freeTimes.length > 0
        ? `${time} não está livre em ${date}. Livres neste dia: ${freeTimes.join(", ")}.`
        : `Não há horário livre em ${date} nesta agenda (dia bloqueado, sem expediente ou tudo ocupado).`,
    );
  }
}

async function freeTimesIgnoring(
  agenda: { id: string; slotDuration: number },
  date: string,
  slots: Awaited<ReturnType<typeof computeAgendaTimeSlots>>,
  appointmentId: string,
): Promise<string[]> {
  const others = await prisma.appointment.findMany({
    where: {
      agendaId: agenda.id,
      id: { not: appointmentId },
      status: { not: "CANCELLED" },
      startsAt: { gte: dayjs.tz(date, "YYYY-MM-DD", TZ).startOf("day").toDate(), lte: dayjs.tz(date, "YYYY-MM-DD", TZ).endOf("day").toDate() },
    },
    select: { startsAt: true, endsAt: true },
  });
  return slots
    .filter((slot) => !slot.isPast && !slot.isBlocked)
    .filter((slot) => {
      const start = dayjs.tz(`${date}T${slot.startTime}`, TZ);
      const end = start.add(agenda.slotDuration, "minute");
      const overlaps = (range: { startsAt: Date; endsAt: Date }) => start.isBefore(dayjs(range.endsAt)) && end.isAfter(dayjs(range.startsAt));
      return !others.some(overlaps);
    })
    .map((slot) => slot.startTime);
}

const toLocal = (date: Date) => dayjs(date).tz(TZ).format("YYYY-MM-DD HH:mm");
const dayInput = (description: string) => z.string().describe(`${description} (AAAA-MM-DD, horário de Brasília)`);

export function registerAgendaMcpTools(server: McpServer, caller: ExternalAiCaller) {
  server.registerTool(
    "agenda_list_agendas",
    {
      description: "Agendas ativas das suas empresas: duração de cada horário, responsáveis e o funil onde caem os leads. Comece por aqui.",
      inputSchema: {},
    },
    () =>
      runAgendaTool(caller, async () => {
        const organizationIds = await listCallerOrganizationIds(caller);
        const allowed = await Promise.all(organizationIds.map((organizationId) => isAgendaActionAllowed(caller, organizationId, "view")));
        const agendas = await prisma.agenda.findMany({
          where: { isActive: true, organizationId: { in: organizationIds.filter((_, index) => allowed[index]) } },
          select: {
            id: true,
            name: true,
            slotDuration: true,
            specialty: true,
            unit: true,
            organization: { select: { id: true, name: true } },
            tracking: { select: { id: true, name: true } },
            responsibles: { select: { user: { select: { id: true, name: true } } } },
          },
          orderBy: { name: "asc" },
        });
        return agendas.map((agenda) => ({
          agendaId: agenda.id,
          name: agenda.name,
          slotMinutes: agenda.slotDuration,
          specialty: agenda.specialty,
          unit: agenda.unit,
          organization: agenda.organization,
          tracking: agenda.tracking,
          responsibles: agenda.responsibles.map((responsible) => responsible.user),
        }));
      }),
  );

  server.registerTool(
    "agenda_list_free_slots",
    {
      description: `Horários livres de uma agenda, dia a dia, por até ${MAX_SLOT_DAYS} dias. São os mesmos da página pública de agendamento.`,
      inputSchema: { agendaId: z.string(), dateFrom: dayInput("Primeiro dia"), dateTo: dayInput("Último dia").optional() },
    },
    ({ agendaId, dateFrom, dateTo }) =>
      runAgendaTool(caller, async () => {
        const agenda = await loadAgenda(caller, agendaId, "view");
        assertDay(dateFrom, "dateFrom");
        if (dateTo) assertDay(dateTo, "dateTo");
        const first = dayjs.tz(dateFrom, "YYYY-MM-DD", TZ);
        const last = dateTo ? dayjs.tz(dateTo, "YYYY-MM-DD", TZ) : first;
        const totalDays = last.diff(first, "day") + 1;
        if (totalDays < 1 || totalDays > MAX_SLOT_DAYS) throw new Error(`Período de 1 a ${MAX_SLOT_DAYS} dias.`);
        const days = await Promise.all(
          Array.from({ length: totalDays }, async (_, offset) => {
            const date = first.add(offset, "day").format("YYYY-MM-DD");
            const slots = await computeAgendaTimeSlots({ agenda, date });
            return { date, weekday: WEEKDAYS[first.add(offset, "day").day()], freeTimes: slots.map((slot) => slot.startTime) };
          }),
        );
        return { agendaId: agenda.id, name: agenda.name, slotMinutes: agenda.slotDuration, timeZone: TZ, days };
      }),
  );

  server.registerTool(
    "agenda_list_appointments",
    {
      description: `Compromissos de um período (até ${MAX_APPOINTMENT_DAYS} dias), de uma agenda ou de todas as suas, com o lead. Horários em Brasília. Cancelados só com includeCancelled.`,
      inputSchema: {
        dateFrom: dayInput("Primeiro dia"),
        dateTo: dayInput("Último dia"),
        agendaId: z.string().optional(),
        includeCancelled: z.boolean().optional(),
      },
    },
    ({ dateFrom, dateTo, agendaId, includeCancelled }) =>
      runAgendaTool(caller, async () => {
        assertDay(dateFrom, "dateFrom");
        assertDay(dateTo, "dateTo");
        const start = dayjs.tz(dateFrom, "YYYY-MM-DD", TZ).startOf("day");
        const end = dayjs.tz(dateTo, "YYYY-MM-DD", TZ).endOf("day");
        if (end.isBefore(start) || end.diff(start, "day") + 1 > MAX_APPOINTMENT_DAYS) throw new Error(`Período de 1 a ${MAX_APPOINTMENT_DAYS} dias.`);

        let agendaFilter: Prisma.AppointmentWhereInput;
        if (agendaId) {
          await loadAgenda(caller, agendaId, "view");
          agendaFilter = { agendaId };
        } else {
          const organizationIds = await listCallerOrganizationIds(caller);
          const allowed = await Promise.all(organizationIds.map((organizationId) => isAgendaActionAllowed(caller, organizationId, "view")));
          agendaFilter = { agenda: { organizationId: { in: organizationIds.filter((_, index) => allowed[index]) } } };
        }
        const appointments = await prisma.appointment.findMany({
          where: {
            ...agendaFilter,
            startsAt: { gte: start.toDate(), lte: end.toDate() },
            ...(includeCancelled ? {} : { status: { not: "CANCELLED" } }),
          },
          orderBy: { startsAt: "asc" },
          take: APPOINTMENTS_LIMIT,
          select: {
            id: true,
            title: true,
            status: true,
            meetingType: true,
            notes: true,
            startsAt: true,
            endsAt: true,
            agenda: { select: { id: true, name: true } },
            lead: { select: { id: true, name: true, phone: true } },
          },
        });
        return appointments.map((appointment) => ({
          appointmentId: appointment.id,
          title: appointment.title,
          status: appointment.status,
          meetingType: appointment.meetingType,
          notes: appointment.notes,
          startsAt: toLocal(appointment.startsAt),
          endsAt: toLocal(appointment.endsAt),
          agenda: appointment.agenda,
          lead: appointment.lead,
        }));
      }),
  );

  server.registerTool(
    "agenda_create_appointment",
    {
      description:
        "Marca um compromisso confirmado num horário livre (veja agenda_list_free_slots). Para um lead que já existe (leadId, de tracking_list_leads) ou por nome e telefone: o telefone acha o lead no funil da agenda ou cria um. Mostre ao usuário dia, hora e pessoa e espere a confirmação antes.",
      inputSchema: {
        agendaId: z.string(),
        date: dayInput("Dia"),
        time: z.string().describe("Hora de início, HH:mm"),
        leadId: z.string().optional(),
        name: z.string().trim().min(1).max(200).optional().describe("Obrigatório sem leadId"),
        phone: z.string().max(30).optional().describe("Obrigatório sem leadId, com DDD"),
        email: z.string().email().max(200).optional(),
        title: z.string().trim().max(200).optional(),
        notes: z.string().max(5000).optional(),
        meetingType: z.enum(["ONLINE", "IN_PERSON"]).optional(),
      },
    },
    (input) =>
      runAgendaTool(caller, async () => {
        const agenda = await loadAgenda(caller, input.agendaId, "create");
        assertDay(input.date, "date");
        assertTime(input.time);

        let name = input.name;
        let phone = input.phone ? normalizeWhatsappPhoneBr(input.phone) : null;
        if (input.leadId) {
          const lead = await prisma.lead.findFirst({ where: { id: input.leadId, tracking: { organizationId: agenda.organizationId } }, select: { name: true, phone: true } });
          if (!lead) throw new Error("Lead não encontrado.");
          name = name ?? lead.name;
          phone = phone ?? lead.phone;
        } else if (!name || !phone) {
          throw new Error("Mande leadId, ou nome e telefone com DDD.");
        }
        await assertFreeSlot(agenda, input.date, input.time);

        const appointment = await createAgendaAppointment({
          organizationId: agenda.organizationId,
          actor: await loadActor(caller),
          via: caller.label,
          input: {
            agendaId: agenda.id,
            date: input.date,
            time: input.time,
            timeZone: TZ,
            name: name ?? "",
            phone: phone ?? "",
            email: input.email,
            title: input.title,
            notes: input.notes,
            meetingType: input.meetingType,
            leadId: input.leadId,
          },
        });
        return { appointmentId: appointment.id, status: appointment.status, startsAt: toLocal(appointment.startsAt), endsAt: toLocal(appointment.endsAt), leadId: appointment.leadId };
      }),
  );

  server.registerTool(
    "agenda_reschedule_appointment",
    {
      description: "Muda o compromisso para outro horário livre da mesma agenda. Confirme com o usuário antes.",
      inputSchema: { appointmentId: z.string(), date: dayInput("Novo dia"), time: z.string().describe("Nova hora, HH:mm") },
    },
    ({ appointmentId, date, time }) =>
      runAgendaTool(caller, async () => {
        const appointment = await loadAppointment(caller, appointmentId, "edit");
        if (appointment.status === "CANCELLED") throw new Error("Compromisso cancelado não pode ser remarcado: marque um novo.");
        assertDay(date, "date");
        assertTime(time);
        await assertFreeSlot({ id: appointment.agendaId, slotDuration: appointment.agenda.slotDuration }, date, time, appointment.id);
        const startsAt = dayjs.tz(`${date} ${time}`, TZ);
        const updated = await rescheduleAgendaAppointment({
          organizationId: appointment.agenda.organizationId,
          actor: await loadActor(caller),
          via: caller.label,
          appointmentId,
          startsAt: startsAt.toDate(),
          endsAt: startsAt.add(appointment.agenda.slotDuration, "minute").toDate(),
        });
        return { appointmentId: updated.id, startsAt: toLocal(updated.startsAt), endsAt: toLocal(updated.endsAt) };
      }),
  );

  server.registerTool(
    "agenda_cancel_appointment",
    {
      description: "Cancela o compromisso e libera o horário. Confirme com o usuário antes.",
      inputSchema: { appointmentId: z.string() },
    },
    ({ appointmentId }) =>
      runAgendaTool(caller, async () => {
        const appointment = await loadAppointment(caller, appointmentId, "delete");
        const updated = await cancelAgendaAppointment({ organizationId: appointment.agenda.organizationId, actor: await loadActor(caller), via: caller.label, appointmentId });
        return { appointmentId: updated.id, status: updated.status };
      }),
  );
}
