import "server-only";

import {
  loadMonthCashSnapshot,
  projectedCashOf,
  projectedExpenseOf,
  projectedRevenueOf,
  type MonthCashSnapshot,
} from "./month-cash-snapshot";
import { resolveGoalForMonth, type ResolvedGoal } from "./resolve-goal";

/**
 * Situação de um mês contra a meta cadastrada.
 *
 * Duas réguas de reserva convivem de propósito (decisão D-2 da spec 0011): a
 * de hoje mede o percentual sobre o que já entrou, e a projetada mede sobre o
 * mês fechado. O alerta usa a projetada — a de hoje é sempre pequena no dia 1º
 * e acenderia vermelho todo início de mês.
 */

export interface GoalStatus {
  year: number;
  month: number;
  revenueTargetCents: number;
  cashReservePercent: number;
  hasRevenueTarget: boolean;
  hasMonthOverride: boolean;
  receivedRevenue: number;
  projectedRevenue: number;
  paidExpense: number;
  openPayable: number;
  projectedExpense: number;
  projectedCash: number;
  reserveTargetNow: number;
  reserveTargetProjected: number;
  /** Quanto o caixa projetado passa (ou falta para) a reserva projetada. */
  reserveGap: number;
  goalProgressPercent: number;
  isGoalReached: boolean;
  isReserveAtRisk: boolean;
}

export function monthBounds(year: number, month: number): { start: Date; end: Date } {
  return {
    start: new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0)),
    end: new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)),
  };
}

export function buildGoalStatus(params: {
  year: number;
  month: number;
  goal: ResolvedGoal;
  snapshot: MonthCashSnapshot;
}): GoalStatus {
  const { year, month, goal, snapshot } = params;

  const projectedRevenue = projectedRevenueOf(snapshot);
  const projectedExpense = projectedExpenseOf(snapshot);
  const projectedCash = projectedCashOf(snapshot);

  const percentOf = (base: number) =>
    Math.round((base * goal.cashReservePercent) / 100);
  const reserveTargetProjected = percentOf(projectedRevenue);

  return {
    year,
    month,
    revenueTargetCents: goal.revenueTargetCents,
    cashReservePercent: goal.cashReservePercent,
    hasRevenueTarget: goal.hasRevenueTarget,
    hasMonthOverride: goal.hasMonthOverride,
    receivedRevenue: snapshot.receivedRevenue,
    projectedRevenue,
    paidExpense: snapshot.paidExpense,
    openPayable: snapshot.openPayable,
    projectedExpense,
    projectedCash,
    reserveTargetNow: percentOf(snapshot.receivedRevenue),
    reserveTargetProjected,
    reserveGap: projectedCash - reserveTargetProjected,
    goalProgressPercent: goal.hasRevenueTarget
      ? (snapshot.receivedRevenue / goal.revenueTargetCents) * 100
      : 0,
    isGoalReached:
      goal.hasRevenueTarget &&
      snapshot.receivedRevenue >= goal.revenueTargetCents,
    // Com reserva 0% só é risco quando o mês fecha negativo — CB-2.
    isReserveAtRisk: projectedCash < reserveTargetProjected,
  };
}

export async function loadGoalStatus(params: {
  organizationId: string;
  year: number;
  month: number;
}): Promise<GoalStatus> {
  const { organizationId, year, month } = params;
  const period = monthBounds(year, month);

  const [goal, snapshot] = await Promise.all([
    resolveGoalForMonth({ organizationId, year, month }),
    loadMonthCashSnapshot({ organizationId, period }),
  ]);

  return buildGoalStatus({ year, month, goal, snapshot });
}
