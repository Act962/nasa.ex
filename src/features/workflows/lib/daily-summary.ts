import "server-only";
import prisma from "@/lib/prisma";
import { computeBriefingPeriod } from "@/features/astro/server/briefings/build-app-briefings";

// Números do resumo do dia de uma empresa (spec 0101, RF-4): só contagens no banco, nenhuma IA.
// Reaproveita os períodos do painel do Astro ("hoje" e "esta semana" no horário de São Paulo).

const DAY_MS = 24 * 60 * 60_000;

export type DailySummary = Record<
  "data" | "leads_ontem" | "leads_semana" | "agendamentos_hoje" | "conversas_sem_resposta" | "demandas_hoje" | "demandas_atrasadas",
  string
>;

export async function buildDailySummary(organizationId: string, now = new Date()): Promise<DailySummary> {
  const period = computeBriefingPeriod(now);
  const yesterdayStart = new Date(period.dayStart.getTime() - DAY_MS);
  const organizationTrackings = { organizationId, isArchived: false };
  const openTasks = { isDone: false, isArchived: false, workspace: { organizationId, isArchived: false } };

  const [leadsYesterday, leadsThisWeek, appointmentsToday, conversationsWaiting, tasksDueToday, tasksOverdue] = await Promise.all([
    prisma.lead.count({ where: { tracking: organizationTrackings, createdAt: { gte: yesterdayStart, lt: period.dayStart } } }),
    prisma.lead.count({ where: { tracking: organizationTrackings, createdAt: { gte: period.weekStart } } }),
    prisma.appointment.count({
      where: { agenda: { organizationId }, status: { in: ["PENDING", "CONFIRMED"] }, startsAt: { gte: period.dayStart, lt: period.dayEnd } },
    }),
    // Mesma régua do contador do Chat: o lead mandou algo e ninguém respondeu depois.
    prisma.conversation.count({
      where: {
        isActive: true,
        tracking: organizationTrackings,
        lead: {
          isArchived: false,
          lastInboundAt: { not: null },
          OR: [{ lastOutboundAt: null }, { lastOutboundAt: { lt: prisma.lead.fields.lastInboundAt } }],
        },
      },
    }),
    prisma.action.count({ where: { ...openTasks, dueDate: { gte: period.dayStart, lt: period.dayEnd } } }),
    prisma.action.count({ where: { ...openTasks, dueDate: { lt: period.dayStart } } }),
  ]);

  return {
    data: new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", day: "2-digit", month: "2-digit" }).format(now),
    leads_ontem: String(leadsYesterday),
    leads_semana: String(leadsThisWeek),
    agendamentos_hoje: String(appointmentsToday),
    conversas_sem_resposta: String(conversationsWaiting),
    demandas_hoje: String(tasksDueToday),
    demandas_atrasadas: String(tasksOverdue),
  };
}
