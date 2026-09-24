import "server-only";
import prisma from "@/lib/prisma";
import { ASKS, plural, startOfToday, type AstroQuery } from "./types";

// Consultas da Agenda — agendas, compromissos e lembretes.

const listAgendas: AstroQuery = {
  key: "agenda.list",
  app: "agenda",
  matches: (text) => ASKS.test(text) && /\bagendas?\b/.test(text) && !/\bhoje|semana|compromisso|reuniao|reunioes\b/.test(text),
  run: async (ctx) => {
    const agendas = await prisma.agenda.findMany({
      where: { organizationId: ctx.organizationId },
      select: { id: true, name: true, isActive: true },
      orderBy: { name: "asc" },
    });
    if (agendas.length === 0) return { text: "Você ainda não tem nenhuma agenda." };
    return {
      text: agendas.length === 1 ? "Você tem 1 agenda:" : `Você tem ${agendas.length} agendas:`,
      table: {
        kind: "astro_table",
        entityType: "agenda",
        title: "Suas agendas",
        columns: [
          { key: "name", label: "Agenda" },
          { key: "situacao", label: "Situação", type: "badge" },
        ],
        rows: agendas.map((agenda) => ({
          id: agenda.id,
          name: agenda.name,
          situacao: agenda.isActive ? "Ativa" : "Inativa",
        })),
        totalCount: agendas.length,
      },
    };
  },
};

const appointmentsToday: AstroQuery = {
  key: "agenda.appointments_today",
  app: "agenda",
  matches: (text) =>
    /\bcompromissos?|reuni(ao|oes)|agendamentos?\b/.test(text) &&
    /\bhoje|amanha|semana|essa semana|quais|quantos|tenho\b/.test(text),
  run: async (ctx) => {
    const from = startOfToday();
    const to = new Date(from.getTime() + 7 * 24 * 60 * 60_000);
    const appointments = await prisma.appointment.findMany({
      where: {
        agenda: { organizationId: ctx.organizationId },
        status: { not: "CANCELLED" },
        startsAt: { gte: from, lt: to },
      },
      select: {
        id: true,
        title: true,
        startsAt: true,
        agenda: { select: { name: true } },
        lead: { select: { name: true } },
      },
      orderBy: { startsAt: "asc" },
      take: 30,
    });
    if (appointments.length === 0) {
      return { text: "Nenhum compromisso marcado para os próximos 7 dias." };
    }
    return {
      text: `${appointments.length} ${plural(appointments.length, "compromisso", "compromissos")} nos próximos 7 dias:`,
      table: {
        kind: "astro_table",
        entityType: "appointment",
        title: "Próximos compromissos",
        columns: [
          { key: "quando", label: "Quando", type: "date" },
          { key: "title", label: "Assunto" },
          { key: "cliente", label: "Cliente" },
          { key: "agenda", label: "Agenda" },
        ],
        rows: appointments.map((item) => ({
          id: item.id,
          quando: item.startsAt.toISOString(),
          title: item.title ?? "Sem título",
          cliente: item.lead?.name ?? "—",
          agenda: item.agenda.name,
        })),
        totalCount: appointments.length,
      },
    };
  },
};

const activeReminders: AstroQuery = {
  key: "agenda.reminders_active",
  app: "agenda",
  matches: (text) => ASKS.test(text) && /\blembretes?\b/.test(text),
  run: async (ctx) => {
    const reminders = await prisma.reminder.findMany({
      where: { createdByUserId: ctx.userId, isActive: true },
      select: { id: true, message: true, remindTime: true, nextRemindAt: true },
      orderBy: { nextRemindAt: "asc" },
      take: 30,
    });
    if (reminders.length === 0) return { text: "Você não tem lembretes ativos." };
    return {
      text: `${reminders.length} ${plural(reminders.length, "lembrete ativo", "lembretes ativos")}:`,
      table: {
        kind: "astro_table",
        entityType: "appointment",
        title: "Lembretes ativos",
        columns: [
          { key: "message", label: "Lembrete" },
          { key: "hora", label: "Hora" },
          { key: "proximo", label: "Próximo", type: "date" },
        ],
        rows: reminders.map((item) => ({
          id: item.id,
          message: item.message,
          hora: item.remindTime,
          proximo: item.nextRemindAt?.toISOString() ?? null,
        })),
        totalCount: reminders.length,
      },
    };
  },
};

export const AGENDA_QUERIES: AstroQuery[] = [
  appointmentsToday,
  activeReminders,
  listAgendas,
];
