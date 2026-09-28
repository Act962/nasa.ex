import "server-only";

import prisma from "@/lib/prisma";
import { loadGoalStatus } from "./goal-status";
import { OPEN_STATUSES } from "./month-cash-snapshot";
import {
  GOAL_NOTIF_TYPES,
  formatCents,
  notifyGoalWatchers,
} from "./notify-goal-watchers";

/**
 * Avisa quando uma despesa recém-lançada derruba o caixa projetado do mês
 * abaixo da reserva.
 *
 * O alerta é sobre **cruzar** o limite: se o mês já estava abaixo da reserva
 * antes desta despesa, o cron diário já notificou e repetir aqui só gera ruído
 * (CB-9). Como despesa não mexe na receita, a reserva-alvo é a mesma antes e
 * depois — basta somar o valor de volta para saber onde o caixa estava.
 *
 * Best-effort: nunca propaga erro, porque o lançamento já está persistido.
 */
export async function checkExpenseBreaksReserve(params: {
  organizationId: string;
  entries: Array<{ amount: number; dueDate: Date; type: string; status: string }>;
}): Promise<void> {
  const { organizationId, entries } = params;

  // Só o que já pesa no caixa do mês. Despesa em `PENDING_APPROVAL` ainda não
  // entra no projetado — somá-la de volta inflaria o "antes" e acusaria um
  // cruzamento que não houve. Ela é reavaliada quando a aprovação sai.
  const countedStatuses = new Set<string>(OPEN_STATUSES);
  const payables = entries.filter(
    (entry) => entry.type === "PAYABLE" && countedStatuses.has(entry.status),
  );
  if (payables.length === 0) return;

  try {
    const config = await prisma.paymentGoalConfig.findUnique({
      where: { organizationId },
      select: { alertExpenseBreaksReserve: true },
    });
    if (!config?.alertExpenseBreaksReserve) return;

    const addedByMonth = new Map<string, { year: number; month: number; added: number }>();
    for (const payable of payables) {
      const year = payable.dueDate.getUTCFullYear();
      const month = payable.dueDate.getUTCMonth() + 1;
      const key = `${year}-${month}`;
      const bucket = addedByMonth.get(key) ?? { year, month, added: 0 };
      bucket.added += payable.amount;
      addedByMonth.set(key, bucket);
    }

    for (const { year, month, added } of addedByMonth.values()) {
      const status = await loadGoalStatus({ organizationId, year, month });

      const cashBefore = status.projectedCash + added;
      const crossedTheLine =
        cashBefore >= status.reserveTargetProjected &&
        status.projectedCash < status.reserveTargetProjected;

      if (!crossedTheLine) continue;

      await notifyGoalWatchers({
        organizationId,
        type: GOAL_NOTIF_TYPES.expenseCritical,
        title: "Despesa derruba a reserva do mês",
        body:
          `Com ${formatCents(added)} de despesa lançada, o caixa projetado de ` +
          `${String(month).padStart(2, "0")}/${year} cai para ` +
          `${formatCents(status.projectedCash)}, abaixo da reserva de ` +
          `${formatCents(status.reserveTargetProjected)}.`,
        severity: "warning",
        metadata: { year, month, added, projectedCash: status.projectedCash },
      });
    }
  } catch (err) {
    console.error("[checkExpenseBreaksReserve] falhou", err);
  }
}
