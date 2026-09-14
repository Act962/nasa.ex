import "server-only";

import prisma from "@/lib/prisma";
import { loadGoalStatus } from "./goal-status";
import {
  GOAL_NOTIF_TYPES,
  formatCents,
  notifyGoalWatchers,
} from "./notify-goal-watchers";

/**
 * Lógica dos alertas periódicos, fora do handler do Inngest.
 *
 * O cron só agenda; quem decide o que notificar são estas funções — assim a
 * decisão pode ser exercitada sem subir o agendador.
 */

export interface DailyCheckResult {
  orgs: number;
  reserveAlerts: number;
  goalAlerts: number;
}

export async function runGoalDailyCheck(now: Date = new Date()): Promise<DailyCheckResult> {
  const configs = await prisma.paymentGoalConfig.findMany({
    where: { OR: [{ alertReserveAtRisk: true }, { alertGoalReached: true }] },
    select: {
      organizationId: true,
      alertReserveAtRisk: true,
      alertGoalReached: true,
    },
  });

  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  let reserveAlerts = 0;
  let goalAlerts = 0;

  for (const config of configs) {
    const { organizationId } = config;

    const [status, monthRow] = await Promise.all([
      loadGoalStatus({ organizationId, year, month }),
      prisma.paymentGoalMonth.findUnique({
        where: { organizationId_year_month: { organizationId, year, month } },
      }),
    ]);

    const shouldWarnReserve =
      config.alertReserveAtRisk &&
      status.isReserveAtRisk &&
      !monthRow?.reserveRiskNotifiedAt;

    const shouldCelebrateGoal =
      config.alertGoalReached &&
      status.isGoalReached &&
      !monthRow?.goalReachedNotifiedAt;

    if (!shouldWarnReserve && !shouldCelebrateGoal) continue;

    let reserveDelivered = false;
    let goalDelivered = false;

    if (shouldWarnReserve) {
      const entrega = await notifyGoalWatchers({
        organizationId,
        type: GOAL_NOTIF_TYPES.reserveAtRisk,
        title: "Reserva de caixa em risco",
        body:
          `O mês caminha para fechar com ${formatCents(status.projectedCash)} ` +
          `em caixa, abaixo da reserva de ${formatCents(status.reserveTargetProjected)} ` +
          `(${status.cashReservePercent}% da receita prevista). ` +
          `Faltam ${formatCents(status.openPayable)} de despesa a pagar.`,
        severity: "warning",
        metadata: { year, month, projectedCash: status.projectedCash },
      });
      reserveDelivered = entrega.notified > 0;
      if (reserveDelivered) reserveAlerts++;
    }

    if (shouldCelebrateGoal) {
      const entrega = await notifyGoalWatchers({
        organizationId,
        type: GOAL_NOTIF_TYPES.goalReached,
        title: "Meta de vendas batida",
        body:
          `${formatCents(status.receivedRevenue)} recebidos no mês — ` +
          `a meta era ${formatCents(status.revenueTargetCents)}.`,
        metadata: { year, month, receivedRevenue: status.receivedRevenue },
      });
      goalDelivered = entrega.notified > 0;
      if (goalDelivered) goalAlerts++;
    }

    // Carimbo no mesmo passo do envio: é o que impede o alerta de repetir
    // todo dia até o fim do mês. Só carimba o que chegou a alguém — numa org
    // sem ninguém com acesso ao dashboard, o alerta segue pendente em vez de
    // ser dado como entregue.
    if (!reserveDelivered && !goalDelivered) continue;

    await prisma.paymentGoalMonth.upsert({
      where: { organizationId_year_month: { organizationId, year, month } },
      create: {
        organizationId,
        year,
        month,
        reserveRiskNotifiedAt: reserveDelivered ? now : null,
        goalReachedNotifiedAt: goalDelivered ? now : null,
      },
      update: {
        ...(reserveDelivered ? { reserveRiskNotifiedAt: now } : {}),
        ...(goalDelivered ? { goalReachedNotifiedAt: now } : {}),
      },
    });
  }

  return { orgs: configs.length, reserveAlerts, goalAlerts };
}

export async function runGoalWeeklySummary(now: Date = new Date()): Promise<{ orgs: number; sent: number }> {
  const configs = await prisma.paymentGoalConfig.findMany({
    where: { alertWeeklySummary: true },
    select: { organizationId: true },
  });

  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  let sent = 0;

  for (const { organizationId } of configs) {
    const status = await loadGoalStatus({ organizationId, year, month });

    const goalLine = status.hasRevenueTarget
      ? `${formatCents(status.receivedRevenue)} de ${formatCents(status.revenueTargetCents)} ` +
        `(${status.goalProgressPercent.toFixed(0)}% da meta).`
      : `${formatCents(status.receivedRevenue)} recebidos no mês.`;

    const reserveLine = status.isReserveAtRisk
      ? `Caixa projetado de ${formatCents(status.projectedCash)} — ` +
        `${formatCents(Math.abs(status.reserveGap))} abaixo da reserva.`
      : `Caixa projetado de ${formatCents(status.projectedCash)}, ` +
        `${formatCents(status.reserveGap)} acima da reserva.`;

    const entrega = await notifyGoalWatchers({
      organizationId,
      type: GOAL_NOTIF_TYPES.weeklySummary,
      title: "Resumo semanal do financeiro",
      body: `${goalLine} Faltam ${formatCents(status.openPayable)} de despesa a pagar. ${reserveLine}`,
      severity: status.isReserveAtRisk ? "warning" : "info",
      metadata: { year, month },
    });
    if (entrega.notified > 0) sent++;
  }

  return { orgs: configs.length, sent };
}
