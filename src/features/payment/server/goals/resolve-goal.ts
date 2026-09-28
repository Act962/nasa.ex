import "server-only";

import prisma from "@/lib/prisma";

/**
 * Resolve a meta vigente de um mês: o override daquele mês quando existe,
 * senão o padrão da organização. Campo nulo no override herda o padrão — é o
 * que permite ajustar só a meta de dezembro sem redefinir o percentual.
 */

export interface GoalAlertFlags {
  reserveAtRisk: boolean;
  weeklySummary: boolean;
  goalReached: boolean;
  expenseBreaksReserve: boolean;
}

export interface ResolvedGoal {
  revenueTargetCents: number;
  cashReservePercent: number;
  /** Meta zerada é tratada como "não definida": sem medidor e sem alerta. */
  hasRevenueTarget: boolean;
  hasMonthOverride: boolean;
  alerts: GoalAlertFlags;
}

const NO_GOAL: ResolvedGoal = {
  revenueTargetCents: 0,
  cashReservePercent: 0,
  hasRevenueTarget: false,
  hasMonthOverride: false,
  alerts: {
    reserveAtRisk: false,
    weeklySummary: false,
    goalReached: false,
    expenseBreaksReserve: false,
  },
};

export async function resolveGoalForMonth(params: {
  organizationId: string;
  year: number;
  month: number;
}): Promise<ResolvedGoal> {
  const { organizationId, year, month } = params;

  const [config, override] = await Promise.all([
    prisma.paymentGoalConfig.findUnique({ where: { organizationId } }),
    prisma.paymentGoalMonth.findUnique({
      where: { organizationId_year_month: { organizationId, year, month } },
    }),
  ]);

  if (!config) return NO_GOAL;

  const revenueTargetCents =
    override?.revenueTargetCents ?? config.defaultRevenueTargetCents;
  const cashReservePercent =
    override?.cashReservePercent ?? config.defaultCashReservePercent;

  return {
    revenueTargetCents,
    cashReservePercent,
    hasRevenueTarget: revenueTargetCents > 0,
    hasMonthOverride:
      override?.revenueTargetCents != null ||
      override?.cashReservePercent != null,
    alerts: {
      reserveAtRisk: config.alertReserveAtRisk,
      weeklySummary: config.alertWeeklySummary,
      goalReached: config.alertGoalReached,
      expenseBreaksReserve: config.alertExpenseBreaksReserve,
    },
  };
}
