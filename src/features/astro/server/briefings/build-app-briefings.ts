import prisma from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

/** Frases do resumo de cada App no painel do Astro (spec 0056): só contagens no banco, nenhuma IA. */

// America/Sao_Paulo = UTC-3, fixo desde 2019 (sem horário de verão): "hoje" e "esta semana" no horário do cliente.
const BRT_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface BriefingPeriod {
  dayStart: Date;
  dayEnd: Date;
  weekStart: Date;
  weekEnd: Date;
  monthStart: Date;
  previousMonthStart: Date;
  now: Date;
}

export function computeBriefingPeriod(now = new Date()): BriefingPeriod {
  const brtNow = new Date(now.getTime() - BRT_OFFSET_MS);
  const brtMidnightMs = Date.UTC(brtNow.getUTCFullYear(), brtNow.getUTCMonth(), brtNow.getUTCDate());
  const dayStart = new Date(brtMidnightMs + BRT_OFFSET_MS);
  const daysSinceMonday = (brtNow.getUTCDay() + 6) % 7;
  const weekStart = new Date(dayStart.getTime() - daysSinceMonday * DAY_MS);
  const toBrtMonthStart = (monthOffset: number) =>
    new Date(Date.UTC(brtNow.getUTCFullYear(), brtNow.getUTCMonth() + monthOffset, 1) + BRT_OFFSET_MS);
  return {
    dayStart,
    dayEnd: new Date(dayStart.getTime() + DAY_MS),
    weekStart,
    weekEnd: new Date(weekStart.getTime() + 7 * DAY_MS),
    monthStart: toBrtMonthStart(0),
    previousMonthStart: toBrtMonthStart(-1),
    now,
  };
}

export function formatBrtDayMonth(date: Date) {
  const brtDate = new Date(date.getTime() - BRT_OFFSET_MS);
  return `${String(brtDate.getUTCDate()).padStart(2, "0")}/${String(brtDate.getUTCMonth() + 1).padStart(2, "0")}`;
}

const BRL_FORMATTER = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatBrl(amountInReais: number) {
  return BRL_FORMATTER.format(amountInReais);
}

function formatBrtTime(date: Date) {
  const brtDate = new Date(date.getTime() - BRT_OFFSET_MS);
  return `${String(brtDate.getUTCHours()).padStart(2, "0")}:${String(brtDate.getUTCMinutes()).padStart(2, "0")}`;
}

export function pluralize(count: number, singular: string, plural: string) {
  return count === 1 ? `1 ${singular}` : `${count} ${plural}`;
}

export interface BriefingAudience {
  organizationId: string;
  userId: string;
  firstName: string;
  period: BriefingPeriod;
}

export function userTrackingsFilter({ organizationId, userId }: BriefingAudience): Prisma.TrackingWhereInput {
  return { organizationId, isArchived: false, participants: { some: { userId } } };
}

export async function buildFormsBriefing({ organizationId, firstName, period }: BriefingAudience) {
  const weekResponses = { form: { organizationId }, completedAt: { gte: period.weekStart } };
  const [responseCount, topFormByLeads] = await Promise.all([
    prisma.formResponses.count({ where: weekResponses }),
    prisma.formResponses.groupBy({
      by: ["formId"],
      where: { ...weekResponses, leadId: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { formId: "desc" } },
      take: 1,
    }),
  ]);

  if (responseCount === 0) return `${firstName}, não tivemos respostas de formulários esta semana.`;

  const countText = responseCount === 1 ? "1 resposta chegou" : `${responseCount} respostas chegaram`;
  const topFormId = topFormByLeads[0]?.formId;
  const topForm = topFormId
    ? await prisma.form.findUnique({ where: { id: topFormId }, select: { name: true } })
    : null;
  return topForm
    ? `${firstName}, ${countText} esta semana e o formulário ${topForm.name} trouxe mais leads.`
    : `${firstName}, ${countText} esta semana.`;
}

export async function buildTrackingBriefing(audience: BriefingAudience) {
  const { firstName, period } = audience;
  const weekLeads = { createdAt: { gte: period.weekStart }, tracking: userTrackingsFilter(audience) };
  const [leadCount, topTrackingByLeads] = await Promise.all([
    prisma.lead.count({ where: weekLeads }),
    prisma.lead.groupBy({
      by: ["trackingId"],
      where: weekLeads,
      _count: { _all: true },
      orderBy: { _count: { trackingId: "desc" } },
      take: 1,
    }),
  ]);

  if (leadCount === 0) return `${firstName}, não entraram leads novos esta semana.`;

  const countText = leadCount === 1 ? "1 lead entrou" : `${leadCount} leads entraram`;
  const topTrackingId = topTrackingByLeads[0]?.trackingId;
  const topTracking = topTrackingId
    ? await prisma.tracking.findUnique({ where: { id: topTrackingId }, select: { name: true } })
    : null;
  return topTracking
    ? `${firstName}, ${countText} esta semana e o tracking ${topTracking.name} foi o que mais recebeu.`
    : `${firstName}, ${countText} esta semana.`;
}

/** Mesma régua do contador do Chat: o lead mandou algo e ninguém respondeu depois. */
export async function buildChatBriefing(audience: BriefingAudience) {
  const { firstName } = audience;
  const awaitingReply: Prisma.ConversationWhereInput = {
    isActive: true,
    tracking: userTrackingsFilter(audience),
    lead: {
      isArchived: false,
      lastInboundAt: { not: null },
      OR: [{ lastOutboundAt: null }, { lastOutboundAt: { lt: prisma.lead.fields.lastInboundAt } }],
    },
  };
  const [waitingCount, longestWaiting] = await Promise.all([
    prisma.conversation.count({ where: awaitingReply }),
    prisma.conversation.findFirst({
      where: awaitingReply,
      orderBy: { lead: { lastInboundAt: "asc" } },
      select: { lead: { select: { name: true } } },
    }),
  ]);

  if (waitingCount === 0) return `${firstName}, nenhuma conversa está esperando resposta. Tudo em dia!`;

  const countText =
    waitingCount === 1 ? "1 conversa está esperando resposta" : `${waitingCount} conversas estão esperando resposta`;
  const longestWaitingName = longestWaiting?.lead?.name?.trim();
  return longestWaitingName && waitingCount > 1
    ? `${firstName}, ${countText}. Quem espera há mais tempo é ${longestWaitingName}.`
    : longestWaitingName
      ? `${firstName}, ${countText}: ${longestWaitingName}.`
      : `${firstName}, ${countText}.`;
}

export async function buildAgendaBriefing({ organizationId, firstName, period }: BriefingAudience) {
  const todayAppointments: Prisma.AppointmentWhereInput = {
    agenda: { organizationId },
    status: { in: ["PENDING", "CONFIRMED"] },
    startsAt: { gte: period.dayStart, lt: period.dayEnd },
  };
  const [todayCount, nextAppointment] = await Promise.all([
    prisma.appointment.count({ where: todayAppointments }),
    prisma.appointment.findFirst({
      where: { ...todayAppointments, startsAt: { gte: period.now, lt: period.dayEnd } },
      orderBy: { startsAt: "asc" },
      select: { startsAt: true, title: true, lead: { select: { name: true } } },
    }),
  ]);

  if (todayCount === 0) return `${firstName}, sua agenda está livre hoje.`;

  const countText = `você tem ${pluralize(todayCount, "compromisso", "compromissos")} hoje`;
  if (!nextAppointment) return `${firstName}, ${countText} e todos já passaram.`;
  const nextLabel = nextAppointment.lead?.name ?? nextAppointment.title;
  const nextTime = formatBrtTime(nextAppointment.startsAt);
  return nextLabel
    ? `${firstName}, ${countText}. O próximo é às ${nextTime}, com ${nextLabel}.`
    : `${firstName}, ${countText}. O próximo é às ${nextTime}.`;
}

export async function buildWorkspaceBriefing({ organizationId, userId, firstName, period }: BriefingAudience) {
  const myOpenTasks: Prisma.ActionWhereInput = {
    isDone: false,
    isArchived: false,
    participants: { some: { userId } },
    workspace: { organizationId, isArchived: false },
  };
  const [todayCount, overdueCount] = await Promise.all([
    prisma.action.count({ where: { ...myOpenTasks, dueDate: { gte: period.dayStart, lt: period.dayEnd } } }),
    prisma.action.count({ where: { ...myOpenTasks, dueDate: { lt: period.dayStart } } }),
  ]);

  if (todayCount === 0 && overdueCount === 0) {
    return `${firstName}, você não tem tarefas para hoje nem atrasadas.`;
  }
  const todayText = todayCount > 0 ? `${pluralize(todayCount, "tarefa", "tarefas")} para hoje` : "nenhuma tarefa para hoje";
  const overdueText =
    overdueCount > 0 ? ` e ${pluralize(overdueCount, "atrasada", "atrasadas")}` : ", nenhuma atrasada";
  return `${firstName}, você tem ${todayText}${overdueText}.`;
}

export async function buildForgeBriefing({ organizationId, firstName }: BriefingAudience) {
  const [awaitingCount, viewedCount] = await Promise.all([
    prisma.forgeProposal.count({ where: { organizationId, status: { in: ["ENVIADA", "VISUALIZADA"] } } }),
    prisma.forgeProposal.count({ where: { organizationId, status: "VISUALIZADA" } }),
  ]);

  if (awaitingCount === 0) return `${firstName}, nenhuma proposta está esperando o cliente agora.`;

  const countText = `${pluralize(awaitingCount, "proposta está", "propostas estão")} esperando o cliente`;
  return viewedCount > 0
    ? `${firstName}, ${countText}, e ${pluralize(viewedCount, "já foi vista", "já foram vistas")}.`
    : `${firstName}, ${countText}.`;
}
